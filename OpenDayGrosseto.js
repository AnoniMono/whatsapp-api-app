const axios = require("axios");
require("dotenv").config();

// Load environment variables
const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

// Function to send a location message directly to a WhatsApp user
async function sendFormOpenDayGrosseto(to) {
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
          name: "open_day_grosseto",
          language: { code: "it" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "location",
                  location: {
                    latitude: "42.7636",       // Replace with the desired latitude
                    longitude: "11.1092",      // Replace with the desired longitude
                    name: "Grosseto",          // Optional: name of the location
                    address: "Grosseto, Italy" // Optional: address of the location
                  }
                }
              ]
            },
            { type: "body", parameters: [] }
          ]
        }
      }
    });
    console.log(`Location message sent to ${to}:`, response.data);
  } catch (error) {
    console.error(`Error sending location message to ${to}:`, error.response ? error.response.data : error.message);
  }
}

module.exports = sendFormOpenDayGrosseto;
