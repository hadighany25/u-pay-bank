// utils/sendEmail.js
const nodemailer = require("nodemailer");

// (រក្សាមុខងារផ្ញើ OTP ចាស់នៅដដែល)
const sendOTP = async (userEmail, otpCode, purpose = "register") => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "support.upay@gmail.com",
        pass: "nnglzvpejnqglezt",
      },
    });

    let purposeText = "សម្រាប់ការចុះឈ្មោះគណនីថ្មី";
    if (purpose === "security_pass") {
      purposeText = "សម្រាប់ការផ្លាស់ប្តូរពាក្យសម្ងាត់ (Password) របស់អ្នក";
    } else if (purpose === "security_pin") {
      purposeText = "សម្រាប់ការផ្លាស់ប្តូរលេខកូដ PIN របស់អ្នក";
    } else if (purpose === "forgot") {
      purposeText = "សម្រាប់ការសង្គ្រោះពាក្យសម្ងាត់ (Forgot Password) របស់អ្នក";
    }

    const mailOptions = {
      from: '"U-PAY Security" <support.upay@gmail.com>',
      to: userEmail,
      subject: "U-PAY Verification Code (OTP)",
      html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 15px; padding: 30px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <img src="https://u-pay-bank.fly.dev/images/logo.png" alt="U-PAY" style="width: 140px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin-top: 0;">ស្វាគមន៍មកកាន់ U-PAY</h2>
          <p style="color: #475569; font-size: 15px;">នេះគឺជាលេខកូដសម្ងាត់ OTP ៦ ខ្ទង់របស់អ្នក ${purposeText}៖</p>
          
          <div style="background: #f8fafc; border: 2px dashed #10b981; border-radius: 10px; padding: 15px; margin: 25px 0;">
             <h1 style="color: #10b981; letter-spacing: 8px; font-size: 38px; margin: 0;">${otpCode}</h1>
          </div>
          
          <p style="color: #ef4444; font-size: 13px; font-weight: bold;">ចំណាំ៖ លេខកូដនេះមានសុពលភាពត្រឹមតែ ៣ នាទីប៉ុណ្ណោះ។ សូមកុំចែករំលែកវាទៅកាន់នរណាម្នាក់អោយសោះ!</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
          <p style="color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} U-Pay PLC. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `✅ [Email Sent] OTP ${otpCode} sent to ${userEmail} for (${purpose})`,
    );
    return true;
  } catch (error) {
    console.error("❌ [Email Error]:", error);
    return false;
  }
};

// 🟢 មុខងារថ្មីសម្រាប់ផ្ញើ Reset Link (PIN ឬ Password) ឱ្យដូចទម្រង់រូបភាពដែលបានផ្តល់
const sendResetLink = async (userEmail, userName, resetLink, type = "PIN") => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "support.upay@gmail.com",
        pass: "nnglzvpejnqglezt",
      },
    });

    const isPin = type === "PIN";
    const typeLabel = isPin ? "លេខកូដ (PIN)" : "លេខសម្ងាត់ (Password)";

    const mailOptions = {
      from: '"U-PAY Security" <support.upay@gmail.com>',
      to: userEmail,
      subject: `U-PAY: សំណើកំណត់ ${type} ថ្មី`,
      html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 15px; padding: 30px; text-align: left; box-shadow: 0 4px 10px rgba(0,0,0,0.05); background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 25px;">
              <img src="https://u-pay-bank.fly.dev/images/logo.png" alt="U-PAY" style="width: 140px;">
          </div>
          
          <h2 style="color: #0f172a; margin-top: 0; text-align: center; font-size: 20px;">សំណើកំណត់ ${typeLabel} ថ្មី</h2>
          
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-top: 20px;">
            ជំរាបសួរ <strong>${userName}</strong>,
          </p>
          
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            យើងទទួលបានសំណើរសុំផ្លាស់ប្តូរ <strong>${typeLabel}</strong> សម្រាប់គណនីរបស់អ្នកពីភ្នាក់ងារធនាគារ (Admin)។ សូមចុចប៊ូតុងខាងក្រោមដើម្បីកំណត់វាឡើងវិញដោយខ្លួនឯង៖
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 25px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                កំណត់ ${type} ថ្មីឥឡូវនេះ
              </a>
          </div>
          
          <p style="color: #ef4444; font-size: 13px; font-weight: bold; text-align: center;">⚠️ ចំណាំ៖ តំណភ្ជាប់ (Link) នេះនឹងផុតកំណត់ក្នុងរយៈពេល ៥ នាទី។ ប្រសិនបើអ្នកមិនបានស្នើសុំទេ សូមទាក់ទងមកខាងធនាគារជាបន្ទាន់!</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} U-Pay PLC. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ [Email Sent] Reset Link sent to ${userEmail} for ${type}`);
    return true;
  } catch (error) {
    console.error("❌ [Email Error]:", error);
    return false;
  }
};

module.exports = { sendOTP, sendResetLink };
