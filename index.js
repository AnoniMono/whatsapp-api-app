const express = require("express");
const axios = require("axios");
const fs = require("fs");
const csv = require("csv-parser");
const { parse } = require("json2csv");
const sendWhatsAppLoop = require("./sendLoopText.js");
const sendInterestForm = require("./sendInterestMessage.js");
const sendFormOpenDayGrosseto = require("./OpenDayGrosseto.js");
const sendMessaggioFinale = require("./messaggioFinale.js");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Environment variables
const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;
const verifyToken = process.env.VERIFY_TOKEN;

app.use(express.json());

// Function to delete log files that start with a "+" in the filename
function deleteLogsWithPlusSign() {
  const logDirectory = "logs";

  // Check if the logs directory exists
  if (fs.existsSync(logDirectory)) {
    // Read all files in the logs directory
    fs.readdir(logDirectory, (err, files) => {
      if (err) {
        console.error("Error reading logs directory:", err);
        return;
      }

      // Loop through each file and delete if it starts with a "+"
      files.forEach((file) => {
        if (file.startsWith("+")) {
          const filePath = `${logDirectory}/${file}`;
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`Error deleting file ${filePath}:`, err);
            } else {
              console.log(`Deleted log file: ${filePath}`);
            }
          });
        }
      });
    });
  } else {
    console.log("Logs directory does not exist.");
  }
}

// Helper function to log messages
function logContactActivity(phoneNumber, message) {
  const logFilePath = `logs/${phoneNumber}_log.txt`;
  const logMessage = `${new Date().toISOString()} - ${message}\n`;

  // Ensure the logs directory exists
  if (!fs.existsSync("logs")) {
    fs.mkdirSync("logs");
  }

  // Append the log message to the contact's log file
  fs.appendFileSync(logFilePath, logMessage, (err) => {
    if (err) console.error(`Error writing to log file for ${phoneNumber}:`, err);
  });

  // Call the function to delete any log files that start with "+"
  deleteLogsWithPlusSign();
}

// Helper function to add or update a contact in contattiInteressati.csv
function addOrUpdateContactInInterestedFile(phoneNumber, isOpenDay = false) {
  const csvFilePath = "contattiInteressati.csv";
  const contacts = [];
  const logFilePath = `logs/${phoneNumber}_log.txt`;

  // Read existing contacts if the file exists
  if (fs.existsSync(csvFilePath)) {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (row) => {
        if (row.phone_number === phoneNumber) {
          row.OpenDay = isOpenDay ? "Yes" : row.OpenDay;
          row.log_file = logFilePath;
        }
        contacts.push(row);
      })
      .on("end", () => {
        if (!contacts.some((row) => row.phone_number === phoneNumber)) {
          contacts.push({ phone_number: phoneNumber, OpenDay: isOpenDay ? "Yes" : "No", log_file: logFilePath });
        }

        const csvData = parse(contacts, { fields: ["phone_number", "OpenDay", "log_file"] });
        fs.writeFileSync(csvFilePath, csvData);
        console.log(`Contact ${phoneNumber} has been added or updated in contattiInteressati.csv with log file ${logFilePath}`);
      });
  } else {
    const newContact = [{ phone_number: phoneNumber, OpenDay: isOpenDay ? "Yes" : "No", log_file: logFilePath }];
    const csvData = parse(newContact, { header: true });
    fs.writeFileSync(csvFilePath, `${csvData}\n`);
    console.log(`Contact ${phoneNumber} has been added to contattiInteressati.csv with OpenDay: ${isOpenDay ? "Yes" : "No"} and log file ${logFilePath}`);
  }
}

// Function to send a template message to a specific phone number
async function sendMessage(to) {
  try {
    const response = await axios({
      method: "POST",
      url: `https://graph.facebook.com/v13.0/${phoneNumberId}/messages`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: "messaggio_benvenuto",
          language: { code: "it" },
          components: [
            {
              type: "header",
              parameters: [{ type: "image", image: { link: "https://imgur.com/XEZcHeY.jpg" } }]
            },
            { type: "body", parameters: [] }
          ]
        }
      }
    });
    const logMessage = `Welcome message sent to ${to}: ${JSON.stringify(response.data)}`;
    console.log(logMessage);
    logContactActivity(to, logMessage);
  } catch (error) {
    const errorMessage = `Error sending message to ${to}: ${
      error.response ? JSON.stringify(error.response.data) : error.message
    }`;
    console.error(errorMessage);
    logContactActivity(to, errorMessage);
  }
}


// Function to send messages to contacts from the CSV file
function sendMessagesToContacts() {
  fs.createReadStream("contacts.csv")
    .pipe(csv())
    .on("data", (row) => {
      const phoneNumber = row.phone_number;
      if (phoneNumber) {
        sendMessage(phoneNumber);
      } else {
        console.error("Invalid phone number found in CSV:", row);
      }
    })
    .on("end", () => console.log("All messages have been sent."));
}

// Function to delete a contact from the CSV file
function deleteContact(phoneNumber) {
  const contacts = [];
  fs.createReadStream("contacts.csv")
    .pipe(csv())
    .on("data", (row) => {
      if (row.phone_number !== phoneNumber) contacts.push(row);
    })
    .on("end", () => {
      const csvData = parse(contacts, { fields: ["phone_number"] });
      fs.writeFileSync("contacts.csv", csvData);
      console.log(`Contact ${phoneNumber} has been removed from contacts.csv.`);
      logContactActivity(phoneNumber, "Contact has been removed from contacts.csv.");
    });
}

// Webhook endpoint for incoming messages
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    body.entry.forEach((entry) => {
      entry.changes.forEach((change) => {
        if (change.value.messages) {
          change.value.messages.forEach((message) => {
            const from = message.from;

            if (message.type === "button") {
              switch (message.button.payload) {
                case "Interrompi Chat":
                  console.log(`"Interrompi Chat" button clicked by ${from}. Deleting contact.`);
                  deleteContact(from);
                  break;
                case "Sono Interessato":
                  console.log(`${from} is interested. Sending Interest Form.`);
                  sendInterestForm(from);
                  addOrUpdateContactInInterestedFile(from); // Mark as interested (OpenDay: "No")
                  
                  // Generate log file and log message the first time contact shows interest
                  logContactActivity(from, `${from} is interested. Sending Interest Form.`);
                  break;
                case "Partecipa all'Open Day!":
                  console.log(`Sending Open Day Form to ${from}.`);
                  sendFormOpenDayGrosseto(from);
                  addOrUpdateContactInInterestedFile(from, true); // Mark as interested with OpenDay: "Yes"
                  logContactActivity(from, "Contact signed up for Open Day.");
                  break;
                case "Voglio saperne di più!":
                  console.log('Messaggio finale');
                  sendMessaggioFinale(from);
                  logContactActivity(from, "Sent final message.");
                  break;
                default:
                  console.log(`Unknown button payload: ${message.button.payload}`);
              }
            } else if (message.type === "text") {
              // Log every text message as per the requirement
              console.log(`Message from ${from}: ${message.text.body}`);
              logContactActivity(from, `Message from ${from}: ${message.text.body}`);
              sendWhatsAppLoop(from);
            }
          });
        }
      });
    });
  }

  res.sendStatus(200);
});

// Verification endpoint for webhook setup
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  sendMessagesToContacts();
});
