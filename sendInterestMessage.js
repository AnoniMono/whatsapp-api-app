// sendTemplate.js

const axios = require("axios");
require("dotenv").config();

// Load environment variables
const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

// Function to send a WhatsApp template message
async function sendInterestForm(to) {
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
          name: "messaggio_interesse_grosseto", // Replace with the actual template name you used
          language: {
            code: "it" // Adjust to the correct language code if necessary
          },
          components: [] // No parameters required for a static message template
        }
      }
    });
    console.log(`Template message sent to ${to}:`, response.data);
  } catch (error) {
    console.error(`Error sending template message to ${to}:`, error.response ? error.response.data : error.message);
  }
}

module.exports = sendInterestForm;
