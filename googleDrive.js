const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const TOKEN_PATH = path.join(__dirname, "token.json");

// Load credentials.json
const credentials = require("./credentials.json");

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// Google Drive OAuth 2.0 setup
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Check if we have a previously stored token
if (fs.existsSync(TOKEN_PATH)) {
  const token = fs.readFileSync(TOKEN_PATH);
  oAuth2Client.setCredentials(JSON.parse(token));
} else {
  getNewToken(oAuth2Client);
}

// Get new token if not previously authorized
function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);

  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter the code from that page here: ", (code) => {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Error retrieving access token", err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log("Token stored to", TOKEN_PATH);
      rl.close();
    });
  });
}

// Function to upload file to Google Drive
async function uploadFileToDrive(filePath, mimeType) {
  const drive = google.drive({ version: "v3", auth: oAuth2Client });
  const fileMetadata = {
    name: path.basename(filePath),
    parents: ["your-google-drive-folder-id"], // Add your Google Drive folder ID here
  };
  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    console.log("File uploaded to Google Drive successfully:", response.data);
    return response.data; // Return file details such as id, webViewLink, etc.
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error);
    throw new Error(error.message);
  }
}

module.exports = {
  uploadFileToDrive,
};
