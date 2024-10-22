const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const fs = require("fs");
const util = require("util");
const unlinkFile = util.promisify(fs.unlink); // To delete the file after upload

dotenv.config();

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
  region: process.env.BUCKET_REGION,
});

/**
 * Uploads a file to S3.
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key (filename) to use in S3.
 * @param {string} filePath - The local file path to upload.
 * @param {string} contentType - The MIME type of the file.
 * @returns {Promise<void>}
 */
async function uploadFile(bucketName, key, filePath, contentType) {
  const fileStream = fs.createReadStream(filePath);
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
  };

  const command = new PutObjectCommand(params);
  await s3.send(command);

  // Remove the local file after upload
  await unlinkFile(filePath);
}

/**
 * Deletes a file from S3.
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key (filename) to delete in S3.
 * @returns {Promise<void>}
 */
async function deleteFile(bucketName, key) {
  const params = {
    Bucket: bucketName,
    Key: key,
  };

  const command = new DeleteObjectCommand(params);
  await s3.send(command);
}

module.exports = {
  uploadFile,
  deleteFile,
};
