const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

/**
 * @swagger
 * /api/email/send-email:
 *   post:
 *     summary: Send an email via contact form
 *     tags: [Emails]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               senderEmail:
 *                 type: string
 *                 description: Email address of the sender
 *               senderPassword:
 *                 type: string
 *                 description: Password of the sender email account
 *               subject:
 *                 type: string
 *                 description: Subject of the email
 *               message:
 *                 type: string
 *                 description: The message the user wants to send
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       500:
 *         description: Internal server error
 */
router.post('/send-email', (req, res) => {
    const { senderEmail, senderPassword, subject, message } = req.body;

    // Determine email service based on sender's email domain
    let service = '';
    if (senderEmail.includes('gmail.com')) {
        service = 'Gmail';
    } else if (senderEmail.includes('outlook.com') || senderEmail.includes('hotmail.com') || senderEmail.includes('lau.edu')) {
        service = 'Outlook';
    } else {
        return res.status(400).send('Unsupported email provider');
    }

    // Setup Nodemailer with the selected service
    const transporter = nodemailer.createTransport({
        service: service,  // Dynamically chosen based on the sender email
        auth: {
            user: senderEmail,      // Sender's email
            pass: senderPassword,   // Sender's email password (or app password)
        },
    });

    const mailOptions = {
        from: senderEmail,  // The email of the sender
        to: 'chloe.boueiri@lau.edu',  // Predefined receiver email
        subject: subject,  // Subject from the request body
        text: message,     // Message from the request body
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send(error.toString());
        }
        res.status(200).send('Email sent successfully');
    });
});

module.exports = router;
