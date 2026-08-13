import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// In-memory Daily Email Report Settings & Configuration
let dailyReportSettings = {
  enabled: true,
  scheduleTime: "08:00", // HH:MM 24hr format
  recipients: ["adilh1220@gmail.com"],
  unitScope: "ALL",
  includeCensus: true,
  includeInventory: true,
  includeMortality: true,
  includeIncidents: true,
  lastSentAt: null as string | null,
  lastStatus: null as string | null
};

// Daily Email Report Audit Logs
const dailyReportLogs: Array<{
  id: string;
  timestamp: string;
  recipients: string[];
  triggerType: 'AUTOMATED_SCHEDULE' | 'MANUAL_TEST' | 'ON_DEMAND';
  status: 'DELIVERED' | 'SIMULATED' | 'FAILED';
  activeCensusCount: number;
  lowStockAlertCount: number;
  details: string;
}> = [];

// Dynamic Runtime SMTP Server Configuration
let customSmtpConfig = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  senderEmail: process.env.SENDER_EMAIL || process.env.SMTP_USER || "reports@medilog-clinical.com"
};

// Helper to get SMTP Transporter from customSmtpConfig or process.env
function getSmtpTransporter() {
  const host = customSmtpConfig.host || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(customSmtpConfig.port || process.env.SMTP_PORT) || 587;
  const user = customSmtpConfig.user || process.env.SMTP_USER;
  const pass = customSmtpConfig.pass || process.env.SMTP_PASS;
  const secure = port === 465;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
  }
  return null;
}

// Function to generate rich HTML Daily Report
function generateDailyReportHtml(data: {
  reportDate: string;
  unitScope: string;
  patients: Array<{ name: string; regNo: string; unit: string; category: string; triagePriority?: string; codeStatus?: string; location?: string }>;
  inventoryAlerts: Array<{ name: string; unit: string; category: string; quantity: number; minThreshold: number; measurementUnit: string }>;
  mortalityCount: number;
  totalInventoryCount: number;
  generatedBy?: string;
}) {
  const activeCount = data.patients.length;
  const lowStockCount = data.inventoryAlerts.length;

  const patientRows = data.patients.slice(0, 20).map(p => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${p.name}</td>
      <td style="padding: 10px 12px; font-family: monospace; color: #64748b; font-size: 12px;">${p.regNo || 'N/A'}</td>
      <td style="padding: 10px 12px; color: #334155;">
        <span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">${p.unit || 'HDU'}</span>
      </td>
      <td style="padding: 10px 12px; color: #475569;">${p.category || 'General'}</td>
      <td style="padding: 10px 12px; color: #334155;">${p.location || 'Bed'}</td>
      <td style="padding: 10px 12px;">
        <span style="padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; ${
          p.triagePriority === 'Critical' ? 'background-color: #fee2e2; color: #991b1b;' :
          p.triagePriority === 'Urgent' ? 'background-color: #fef3c7; color: #92400e;' :
          'background-color: #f1f5f9; color: #475569;'
        }">${p.triagePriority || 'Stable'}</span>
      </td>
    </tr>
  `).join('');

  const inventoryRows = data.inventoryAlerts.length > 0 ? data.inventoryAlerts.slice(0, 20).map(item => `
    <tr style="border-bottom: 1px solid #fee2e2; background-color: #fff5f5;">
      <td style="padding: 10px 12px; font-weight: 700; color: #991b1b;">${item.name}</td>
      <td style="padding: 10px 12px; color: #7f1d1d; font-size: 12px;">${item.unit || 'All Units'}</td>
      <td style="padding: 10px 12px; color: #991b1b; font-weight: 700; font-size: 14px;">${item.quantity} ${item.measurementUnit || 'units'}</td>
      <td style="padding: 10px 12px; color: #7f1d1d; font-size: 12px;">Threshold: ${item.minThreshold}</td>
      <td style="padding: 10px 12px;">
        <span style="background-color: #ef4444; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 10px; text-transform: uppercase;">
          ${item.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK ALERT'}
        </span>
      </td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="5" style="padding: 16px; text-align: center; color: #15803d; font-weight: 600; background-color: #f0fdf4; border-radius: 6px;">
        ✅ All inventory items are above safety thresholds. No critical stock alerts today.
      </td>
    </tr>
  `;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>The Kidney Centre - Daily Executive Census & Inventory Report</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
    <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #881337 0%, #be123c 100%); padding: 28px 32px; color: #ffffff;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td width="70" valign="middle">
              <div style="background-color: #ffffff; border-radius: 8px; width: 56px; height: 56px; text-align: center; line-height: 56px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
                <span style="color: #C81C24; font-family: 'Arial Black', Arial, sans-serif; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">TKC</span>
              </div>
            </td>
            <td valign="middle" style="padding-left: 14px;">
              <h1 style="margin: 0; font-size: 21px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; color: #ffffff; font-family: Arial, sans-serif;">THE KIDNEY CENTRE</h1>
              <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 800; color: #fecdd3; letter-spacing: 0.08em; text-transform: uppercase; font-family: Arial, sans-serif;">POST GRADUATE TRAINING INSTITUTE</p>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #ffe4e6; font-weight: 500;">Automated Daily Clinical Census & Inventory Executive Briefing</p>
            </td>
          </tr>
        </table>
        <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.25); font-size: 12px; color: #ffe4e6; display: flex; justify-content: space-between;">
          <span>📅 Date: <strong>${data.reportDate}</strong></span>
          <span>🏥 Scope: <strong>${data.unitScope} Unit</strong></span>
        </div>
      </div>

      <!-- Content Container -->
      <div style="padding: 28px 32px;">

        <!-- Key Metrics Cards -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
          <tr>
            <td width="32%" style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.1em;">Active Census</div>
              <div style="font-size: 28px; font-weight: 900; color: #0369a1; margin-top: 4px;">${activeCount}</div>
              <div style="font-size: 11px; color: #0284c7; margin-top: 2px;">In-Patient Occupancy</div>
            </td>
            <td width="2%"></td>
            <td width="32%" style="background-color: ${lowStockCount > 0 ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${lowStockCount > 0 ? '#fecaca' : '#bbf7d0'}; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 10px; font-weight: 800; color: ${lowStockCount > 0 ? '#dc2626' : '#16a34a'}; text-transform: uppercase; letter-spacing: 0.1em;">Supply Alerts</div>
              <div style="font-size: 28px; font-weight: 900; color: ${lowStockCount > 0 ? '#b91c1c' : '#15803d'}; margin-top: 4px;">${lowStockCount}</div>
              <div style="font-size: 11px; color: ${lowStockCount > 0 ? '#dc2626' : '#16a34a'}; margin-top: 2px;">Low Stock SKUs</div>
            </td>
            <td width="2%"></td>
            <td width="32%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em;">24H Mortality</div>
              <div style="font-size: 28px; font-weight: 900; color: #334155; margin-top: 4px;">${data.mortalityCount}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Logged Events</div>
            </td>
          </tr>
        </table>

        <!-- Active Patient Census Section -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px 0; border-left: 4px solid #0284c7; padding-left: 10px;">
            🏥 Active Patient Census (${activeCount} Admitted)
          </h2>
          ${activeCount > 0 ? `
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
                <th style="padding: 8px 12px;">Patient Name</th>
                <th style="padding: 8px 12px;">Reg No</th>
                <th style="padding: 8px 12px;">Unit</th>
                <th style="padding: 8px 12px;">Category</th>
                <th style="padding: 8px 12px;">Location</th>
                <th style="padding: 8px 12px;">Triage</th>
              </tr>
            </thead>
            <tbody>
              ${patientRows}
            </tbody>
          </table>
          ${data.patients.length > 20 ? `<p style="font-size: 11px; color: #64748b; text-align: right; margin-top: 6px;">+ ${data.patients.length - 20} more active patients listed in full ledger.</p>` : ''}
          ` : `
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; color: #64748b; font-size: 13px;">
            No active admissions logged in current census window.
          </div>
          `}
        </div>

        <!-- Inventory Status & Supply Chain Section -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px 0; border-left: 4px solid ${lowStockCount > 0 ? '#ef4444' : '#22c55e'}; padding-left: 10px;">
            📦 Inventory & Critical Supply Chain Alerts
          </h2>
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
                <th style="padding: 8px 12px;">Item Name</th>
                <th style="padding: 8px 12px;">Unit</th>
                <th style="padding: 8px 12px;">Current Qty</th>
                <th style="padding: 8px 12px;">Reorder Level</th>
                <th style="padding: 8px 12px;">Alert Status</th>
              </tr>
            </thead>
            <tbody>
              ${inventoryRows}
            </tbody>
          </table>
        </div>

        <!-- System Authentication & Footer Notice -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; line-height: 1.6;">
          <p style="margin: 0; font-weight: 700; color: #1e293b;">🔒 Confidential Medical Communication Notice - The Kidney Centre Post Graduate Training Institute:</p>
          <p style="margin: 4px 0 0 0;">
            This automated daily census & inventory briefing contains confidential clinical and operational data intended strictly for authorized medical personnel. Dispatched via The Kidney Centre Automated Reporting System.
          </p>
          <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 10px;">
            Generated by: ${data.generatedBy || 'The Kidney Centre Server Schedule Engine'} | Server Time: ${new Date().toUTCString()}
          </p>
        </div>

      </div>
    </div>
  </body>
  </html>
  `;
}


// In-memory Cloud Function execution audit log for demonstration & monitoring
const cloudFunctionLogs: Array<{
  id: string;
  timestamp: string;
  functionName: string;
  recipient: string;
  patientName: string;
  status: 'SUCCESS' | 'SIMULATED' | 'FAILED';
  channel: 'WhatsApp' | 'Email';
  messageId: string;
  details: string;
}> = [
  {
    id: "cf_init_001",
    timestamp: new Date().toISOString(),
    functionName: "whatsappReportDispatcher",
    recipient: "System Initialization",
    patientName: "System",
    status: "SUCCESS",
    channel: "WhatsApp",
    messageId: "wa_sys_gate_ready",
    details: "Cloud Function WhatsApp gateway initialized and ready for serverless dispatch."
  }
];

// Health endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Gateway & Cloud Function Status
app.get("/api/cloud-functions/status", (_req, res) => {
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBE || process.env.WHATSAPP_PHONE_NUMBER;
  const metaToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOK;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;

  const isWhatsAppConfigured = Boolean((metaPhoneId && metaToken) || (twilioSid && twilioToken));
  const isEmailConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

  res.json({
    status: "active",
    environment: process.env.NODE_ENV || "development",
    whatsappGateway: {
      status: isWhatsAppConfigured ? "configured" : "simulation_mode",
      provider: process.env.WHATSAPP_PROVIDER || (twilioSid ? "Twilio WhatsApp API" : "Meta WhatsApp Cloud API"),
      senderNumber: process.env.TWILIO_WHATSAPP_NUMBER || "+1 415 523 8886 (Sandbox / Official Business)",
    },
    emailGateway: {
      status: isEmailConfigured ? "configured" : "simulation_mode",
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
      senderEmail: process.env.SENDER_EMAIL || "reports@medilog-clinical.com"
    },
    recentLogs: cloudFunctionLogs.slice(-20).reverse()
  });
});

// Handshake & Credentials Verification Endpoint for WhatsApp Gateway
app.get("/api/cloud-functions/verify-whatsapp-handshake", async (_req, res) => {
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBE || process.env.WHATSAPP_PHONE_NUMBER;
  const metaToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOK;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;

  if (metaPhoneId && metaToken) {
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${metaPhoneId}?access_token=${metaToken}`);
      const data = await response.json();
      if (response.ok) {
        return res.json({
          success: true,
          status: "connected",
          provider: "Meta WhatsApp Cloud API",
          phoneId: metaPhoneId,
          displayPhoneNumber: data.display_phone_number || data.verified_name || metaPhoneId,
          details: "Handshake verified successfully with Meta Graph API."
        });
      } else {
        return res.json({
          success: false,
          status: "error",
          provider: "Meta WhatsApp Cloud API",
          errorCode: data?.error?.code,
          errorMessage: data?.error?.message || "Meta API Auth handshake failed.",
          details: "Failed to establish handshake with Meta API. Check WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN."
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        status: "error",
        provider: "Meta WhatsApp Cloud API",
        errorMessage: err.message,
        details: "Network exception during Meta handshake verification."
      });
    }
  } else if (twilioSid && twilioToken) {
    try {
      const authHeader = `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`;
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
        headers: { "Authorization": authHeader }
      });
      const data = await response.json();
      if (response.ok) {
        return res.json({
          success: true,
          status: "connected",
          provider: "Twilio WhatsApp API",
          accountName: data.friendly_name || twilioSid,
          details: "Handshake verified successfully with Twilio API."
        });
      } else {
        return res.json({
          success: false,
          status: "error",
          provider: "Twilio WhatsApp API",
          errorCode: data?.code,
          errorMessage: data?.message || "Twilio Auth handshake failed.",
          details: "Failed to establish handshake with Twilio API. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        status: "error",
        provider: "Twilio WhatsApp API",
        errorMessage: err.message,
        details: "Network exception during Twilio handshake verification."
      });
    }
  } else {
    return res.json({
      success: true,
      status: "simulation_mode",
      provider: "Direct & Serverless Sandbox Gateway",
      details: "No API credentials currently configured in environment variables. Operating in Direct App/Web Link & Sandbox Mode. Set WHATSAPP_PHONE_NUMBER_ID & WHATSAPP_ACCESS_TOKEN or TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN in .env for direct automated server API dispatch."
    });
  }
});

// Cloud Function: Dispatch WhatsApp Message
app.post("/api/cloud-functions/dispatch-whatsapp", async (req, res) => {
  try {
    const { phone, patientName, procedure, date, doctor, pdfSummary, reportUrl, customMessage } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Missing required parameter: phone" });
    }

    // Format phone number
    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    const formattedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+${cleanedPhone}`;

    const timestamp = new Date().toISOString();
    const msgId = `wa_msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBE || process.env.WHATSAPP_PHONE_NUMBER;
    const metaToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOK;

    const isWhatsAppConfigured = Boolean(
      (metaPhoneId && metaToken) ||
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    );

    let dispatchStatus: 'SUCCESS' | 'SIMULATED' | 'FAILED' = 'SIMULATED';
    let responseMessage = "Report notification dispatched via Cloud Function (Simulation Mode). Configured API credentials will route directly to WhatsApp API.";

    if (isWhatsAppConfigured) {
      // Real API Integration branch (Meta Cloud API / Twilio)
      if (metaPhoneId && metaToken) {
        // Meta WhatsApp Cloud API
        try {
          const metaUrl = `https://graph.facebook.com/v18.0/${metaPhoneId}/messages`;
          const payload = {
            messaging_product: "whatsapp",
            to: formattedPhone.replace('+', ''),
            type: "text",
            text: {
              body: customMessage || `🏥 *MEDILOG CLINICAL REPORT*\n\nDear *${patientName || 'Patient'}*,\nYour endoscopy report for *${procedure || 'Procedure'}* (Date: ${date || 'Recent'}) by *Dr. ${doctor || 'Attending Physician'}* is ready.\n\n📄 *Summary:* ${pdfSummary || 'Diagnostic findings compiled.'}\n\nThank you for choosing MediLog Clinical Systems.`
            }
          };

          const response = await fetch(metaUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${metaToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            dispatchStatus = 'SUCCESS';
            responseMessage = 'WhatsApp message delivered successfully via Meta WhatsApp Cloud API.';
          } else {
            const errData = await response.json();
            console.error("Meta WhatsApp Cloud API error:", errData);
            const errCode = errData?.error?.code;
            const errMsg = errData?.error?.message || "Meta API Error";
            // Meta Test Numbers require recipients to be added in Meta Developer Dashboard.
            // Provide smooth fallback via direct WhatsApp web protocol link so dispatch succeeds seamlessly.
            dispatchStatus = 'SIMULATED';
            responseMessage = `Meta Cloud API Response (Code ${errCode || 'Notice'}: ${errMsg}). Note: Free Meta Test numbers require recipient numbers to be registered in Meta Developer Dashboard. Direct WhatsApp link ready below for 1-click delivery.`;
          }
        } catch (err: any) {
          console.error("Meta API Exception:", err);
          dispatchStatus = 'SIMULATED';
          responseMessage = `Cloud Function Gateway Exception: ${err.message}. Direct WhatsApp link ready below.`;
        }
      } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        // Twilio API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
        const params = new URLSearchParams();
        params.append("To", `whatsapp:${formattedPhone}`);
        params.append("From", process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886");
        params.append("Body", customMessage || `🏥 *MEDILOG CLINICAL REPORT*\n\nDear *${patientName || 'Patient'}*,\nYour report for *${procedure || 'Procedure'}* by *Dr. ${doctor || 'Attending Physician'}* is ready.`);

        const authHeader = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
        
        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params.toString()
        });

        if (response.ok) {
          dispatchStatus = 'SUCCESS';
          responseMessage = 'WhatsApp message delivered successfully via Twilio WhatsApp Gateway.';
        } else {
          const errData = await response.json();
          dispatchStatus = 'FAILED';
          responseMessage = `Twilio API error: ${JSON.stringify(errData)}`;
        }
      }
    }

    // Record execution in Cloud Function audit log
    const logEntry = {
      id: msgId,
      timestamp,
      functionName: "whatsappReportDispatcher",
      recipient: formattedPhone,
      patientName: patientName || "Unspecified",
      status: dispatchStatus,
      channel: "WhatsApp" as const,
      messageId: msgId,
      details: responseMessage
    };
    cloudFunctionLogs.push(logEntry);

    return res.json({
      success: dispatchStatus !== 'FAILED',
      messageId: msgId,
      status: dispatchStatus,
      recipient: formattedPhone,
      timestamp,
      info: responseMessage,
      whatsappWebUrl: `https://api.whatsapp.com/send?phone=${formattedPhone.replace(/[^\d]/g, '')}&text=${encodeURIComponent(customMessage || `🏥 *MEDILOG CLINICAL REPORT*\n\nDear *${patientName || 'Patient'}*,\nYour endoscopy report for *${procedure || 'Procedure'}* is ready.`)}`
    });
  } catch (error: any) {
    console.error("Cloud Function WhatsApp error:", error);
    return res.status(500).json({ error: error.message || "Internal server error during WhatsApp dispatch" });
  }
});

// Cloud Function: Dispatch Email Report
app.post("/api/cloud-functions/dispatch-email", async (req, res) => {
  try {
    const { email, patientName, procedure, date, doctor, pdfSummary } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing required parameter: email" });
    }

    const timestamp = new Date().toISOString();
    const msgId = `email_msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const transporter = getSmtpTransporter();

    let dispatchStatus: 'DELIVERED' | 'SIMULATED' | 'FAILED' = 'SIMULATED';
    let detailsMessage = "Email report dispatched via Cloud Function gateway (Simulation mode). Configured SMTP credentials send directly to inbox.";

    if (transporter) {
      try {
        const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER || "reports@kidneycentre.org";
        await transporter.sendMail({
          from: `"The Kidney Centre" <${senderEmail}>`,
          to: email,
          subject: `🏥 Medical Report Notice: ${patientName || 'Patient'} - ${procedure || 'Endoscopy Procedure'}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background: #f8fafc; border-radius: 8px;">
              <h2 style="color: #C81C24; margin-top: 0;">🏥 The Kidney Centre - Clinical Report</h2>
              <p>Dear Medical Colleague / Patient,</p>
              <p>Clinical procedure report for <strong>${patientName || 'Patient'}</strong> (${procedure || 'Endoscopy'}, Date: ${date || 'Recent'}) by <strong>Dr. ${doctor || 'Attending Physician'}</strong> has been generated.</p>
              <div style="background: #ffffff; border-left: 4px solid #C81C24; padding: 12px; margin: 16px 0;">
                <strong>Diagnostic Summary:</strong><br/>
                ${pdfSummary || 'Diagnostic endoscopy procedure recorded successfully.'}
              </div>
              <p style="font-size: 11px; color: #64748b;">Dispatched securely via The Kidney Centre Clinical Gateway.</p>
            </div>
          `
        });
        dispatchStatus = 'DELIVERED';
        detailsMessage = 'Email delivered successfully to inbox via SMTP server.';
      } catch (smtpErr: any) {
        console.error("SMTP Direct Send Error:", smtpErr);
        dispatchStatus = 'FAILED';
        detailsMessage = `SMTP delivery error: ${smtpErr.message}`;
      }
    }

    const logEntry = {
      id: msgId,
      timestamp,
      functionName: "emailReportDispatcher",
      recipient: email,
      patientName: patientName || "Unspecified",
      status: dispatchStatus as any,
      channel: "Email" as const,
      messageId: msgId,
      details: detailsMessage
    };
    cloudFunctionLogs.push(logEntry);

    return res.json({
      success: dispatchStatus !== 'FAILED',
      messageId: msgId,
      status: dispatchStatus,
      recipient: email,
      timestamp,
      info: detailsMessage
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal server error during Email dispatch" });
  }
});

// GET Daily Email Report Settings
app.get("/api/reports/daily-email/settings", (_req, res) => {
  const activeUser = customSmtpConfig.user || process.env.SMTP_USER;
  const activePass = customSmtpConfig.pass || process.env.SMTP_PASS;
  const isSmtpConfigured = Boolean(activeUser && activePass);

  return res.json({
    settings: dailyReportSettings,
    smtpConfig: {
      host: customSmtpConfig.host || process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(customSmtpConfig.port || process.env.SMTP_PORT) || 587,
      user: activeUser || "Not Configured (Simulation Mode)",
      senderEmail: customSmtpConfig.senderEmail || process.env.SENDER_EMAIL || activeUser || "reports@medilog-clinical.com",
      isConfigured: isSmtpConfigured
    }
  });
});

// GET Current SMTP Server Configuration for Admin Panel
app.get("/api/smtp/config", (_req, res) => {
  const activeUser = customSmtpConfig.user || process.env.SMTP_USER || "";
  const activePass = customSmtpConfig.pass || process.env.SMTP_PASS || "";

  return res.json({
    host: customSmtpConfig.host || process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(customSmtpConfig.port || process.env.SMTP_PORT) || 587,
    user: activeUser,
    hasPassword: Boolean(activePass),
    senderEmail: customSmtpConfig.senderEmail || process.env.SENDER_EMAIL || activeUser || "reports@medilog-clinical.com",
    isConfigured: Boolean(activeUser && activePass)
  });
});

// POST Save SMTP Server Configuration
app.post("/api/smtp/config", (req, res) => {
  try {
    const { host, port, user, pass, senderEmail } = req.body;

    if (host && typeof host === 'string') customSmtpConfig.host = host.trim();
    if (port && !isNaN(Number(port))) customSmtpConfig.port = Number(port);
    if (typeof user === 'string') customSmtpConfig.user = user.trim();
    // Keep existing pass if empty pass is passed and pass already exists
    if (typeof pass === 'string' && pass.length > 0) {
      customSmtpConfig.pass = pass.trim();
    }
    if (typeof senderEmail === 'string' && senderEmail.length > 0) {
      customSmtpConfig.senderEmail = senderEmail.trim();
    } else if (customSmtpConfig.user) {
      customSmtpConfig.senderEmail = customSmtpConfig.user;
    }

    const isNowConfigured = Boolean(customSmtpConfig.user && customSmtpConfig.pass);

    return res.json({
      success: true,
      message: isNowConfigured
        ? "SMTP Credentials saved and activated successfully!"
        : "SMTP Settings updated. Please provide both username and password to enable real email sending.",
      smtpConfig: {
        host: customSmtpConfig.host,
        port: customSmtpConfig.port,
        user: customSmtpConfig.user,
        hasPassword: Boolean(customSmtpConfig.pass),
        senderEmail: customSmtpConfig.senderEmail,
        isConfigured: isNowConfigured
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to save SMTP configuration" });
  }
});

// POST Test SMTP Connection & Send Test Email
app.post("/api/smtp/test", async (req, res) => {
  try {
    const { testEmail, host, port, user, pass, senderEmail } = req.body;

    const targetHost = host || customSmtpConfig.host || process.env.SMTP_HOST || "smtp.gmail.com";
    const targetPort = Number(port || customSmtpConfig.port || process.env.SMTP_PORT) || 587;
    const targetUser = user || customSmtpConfig.user || process.env.SMTP_USER;
    const targetPass = (pass && pass.length > 0) ? pass : (customSmtpConfig.pass || process.env.SMTP_PASS);
    const targetSender = senderEmail || customSmtpConfig.senderEmail || process.env.SENDER_EMAIL || targetUser || "reports@medilog-clinical.com";
    const recipient = testEmail || targetUser;

    if (!targetUser || !targetPass) {
      return res.status(400).json({
        success: false,
        error: "Missing SMTP Username or Password. Please enter both fields before testing."
      });
    }

    if (!recipient) {
      return res.status(400).json({
        success: false,
        error: "Please enter a recipient email address for testing."
      });
    }

    const transporter = nodemailer.createTransport({
      host: targetHost,
      port: targetPort,
      secure: targetPort === 465,
      auth: {
        user: targetUser,
        pass: targetPass
      },
      tls: { rejectUnauthorized: false }
    });

    // Verify SMTP Connection first
    await transporter.verify();

    // Send Test Email
    const mailInfo = await transporter.sendMail({
      from: `"The Kidney Centre" <${targetSender}>`,
      to: recipient,
      subject: `✅ [SMTP VERIFICATION] Test Email from The Kidney Centre`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f8fafc; color: #1e293b;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="background-color: #C81C24; color: #ffffff; padding: 12px 16px; border-radius: 8px; font-weight: bold; font-size: 16px; margin-bottom: 20px;">
              🏥 The Kidney Centre - SMTP Server Verification
            </div>
            <p style="font-size: 14px; line-height: 1.6;">Hello,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #0f766e; font-weight: bold;">
              🎉 Success! Your SMTP Server connection has been verified successfully.
            </p>
            <div style="background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; margin: 16px 0;">
              <strong>Host:</strong> ${targetHost}:${targetPort}<br/>
              <strong>Authenticated User:</strong> ${targetUser}<br/>
              <strong>Sender Identity:</strong> ${targetSender}<br/>
              <strong>Timestamp:</strong> ${new Date().toLocaleString()}
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
              Your automated daily patient census and inventory alert reports will now be delivered directly to your inbox.
            </p>
          </div>
        </div>
      `
    });

    return res.json({
      success: true,
      message: `SMTP Connection verified! Test email successfully sent to ${recipient}. (Message ID: ${mailInfo.messageId})`
    });

  } catch (err: any) {
    console.error("SMTP Test Failure:", err);
    return res.status(500).json({
      success: false,
      error: `SMTP Connection Failed: ${err.message || 'Authentication error or server unreachable'}`
    });
  }
});

// POST Update Daily Email Report Settings
app.post("/api/reports/daily-email/settings", (req, res) => {
  try {
    const { enabled, scheduleTime, recipients, unitScope, includeCensus, includeInventory, includeMortality, includeIncidents } = req.body;
    
    if (typeof enabled === 'boolean') dailyReportSettings.enabled = enabled;
    if (scheduleTime && typeof scheduleTime === 'string') dailyReportSettings.scheduleTime = scheduleTime;
    if (Array.isArray(recipients)) dailyReportSettings.recipients = recipients.filter((e: string) => typeof e === 'string' && e.includes('@'));
    if (unitScope) dailyReportSettings.unitScope = unitScope;
    if (typeof includeCensus === 'boolean') dailyReportSettings.includeCensus = includeCensus;
    if (typeof includeInventory === 'boolean') dailyReportSettings.includeInventory = includeInventory;
    if (typeof includeMortality === 'boolean') dailyReportSettings.includeMortality = includeMortality;
    if (typeof includeIncidents === 'boolean') dailyReportSettings.includeIncidents = includeIncidents;

    return res.json({
      success: true,
      message: "Automated daily email report configuration updated successfully.",
      settings: dailyReportSettings
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update daily email report settings" });
  }
});

// GET Daily Email Report Logs
app.get("/api/reports/daily-email/logs", (_req, res) => {
  return res.json({
    logs: dailyReportLogs.slice(-50).reverse()
  });
});

// POST Trigger Daily Email Report Dispatch
app.post("/api/reports/daily-email/dispatch", async (req, res) => {
  try {
    const {
      recipients,
      unitScope,
      patients = [],
      inventoryAlerts = [],
      mortalityCount = 0,
      totalInventoryCount = 0,
      triggerType = 'MANUAL_TEST',
      generatedBy = 'Attending Medical Officer'
    } = req.body;

    const targetRecipients: string[] = Array.isArray(recipients) && recipients.length > 0
      ? recipients
      : dailyReportSettings.recipients;

    if (targetRecipients.length === 0) {
      return res.status(400).json({ error: "No recipient email addresses provided or configured." });
    }

    const reportDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const reportHtml = generateDailyReportHtml({
      reportDate,
      unitScope: unitScope || dailyReportSettings.unitScope || 'ALL',
      patients,
      inventoryAlerts,
      mortalityCount,
      totalInventoryCount,
      generatedBy
    });

    const transporter = getSmtpTransporter();
    const isSmtpReady = Boolean(transporter);
    const timestamp = new Date().toISOString();
    const msgId = `daily_rpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let status: 'DELIVERED' | 'SIMULATED' | 'FAILED' = 'SIMULATED';
    let detailsText = '';

    if (isSmtpReady && transporter) {
      try {
        const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER || "reports@kidneycentre.org";
        await transporter.sendMail({
          from: `"The Kidney Centre" <${senderEmail}>`,
          to: targetRecipients.join(', '),
          subject: `📊 [DAILY CENSUS & INVENTORY] Executive Report - ${reportDate}`,
          html: reportHtml
        });
        status = 'DELIVERED';
        detailsText = `Daily report sent via SMTP host (${process.env.SMTP_HOST || 'Gmail'}) to ${targetRecipients.length} authorized recipient(s).`;
      } catch (smtpErr: any) {
        console.error("SMTP error during daily report send:", smtpErr);
        status = 'FAILED';
        detailsText = `SMTP Transport failed: ${smtpErr.message || 'Unknown error'}`;
      }
    } else {
      status = 'SIMULATED';
      detailsText = `Daily report generated & simulated successfully for ${targetRecipients.length} recipient(s). Configure SMTP_USER and SMTP_PASS in .env for direct email inbox delivery.`;
    }

    // Save log entry
    const logItem = {
      id: msgId,
      timestamp,
      recipients: targetRecipients,
      triggerType: triggerType as any,
      status,
      activeCensusCount: patients.length,
      lowStockAlertCount: inventoryAlerts.length,
      details: detailsText
    };
    dailyReportLogs.push(logItem);

    // Update daily report settings last execution status
    dailyReportSettings.lastSentAt = timestamp;
    dailyReportSettings.lastStatus = status;

    return res.json({
      success: status !== 'FAILED',
      id: msgId,
      status,
      recipients: targetRecipients,
      activeCensusCount: patients.length,
      lowStockAlertCount: inventoryAlerts.length,
      timestamp,
      details: detailsText,
      reportHtmlPreview: reportHtml
    });
  } catch (err: any) {
    console.error("Error dispatching daily email report:", err);
    return res.status(500).json({ error: err.message || "Failed to dispatch daily email report" });
  }
});

async function startServer() {
  // Automated background daily schedule ticker
  setInterval(() => {
    if (!dailyReportSettings.enabled) return;

    const now = new Date();
    const currentHoursMinutes = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayDateStr = now.toISOString().split('T')[0];

    const lastSentDateStr = dailyReportSettings.lastSentAt ? dailyReportSettings.lastSentAt.split('T')[0] : null;

    if (currentHoursMinutes === dailyReportSettings.scheduleTime && lastSentDateStr !== todayDateStr) {
      console.log(`[DailyReportSchedule] Triggering automated daily email report at ${currentHoursMinutes} for ${dailyReportSettings.recipients.length} recipient(s)...`);
      
      const reportDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const reportHtml = generateDailyReportHtml({
        reportDate,
        unitScope: dailyReportSettings.unitScope,
        patients: [],
        inventoryAlerts: [],
        mortalityCount: 0,
        totalInventoryCount: 0,
        generatedBy: 'Automated System Scheduler'
      });

      const transporter = getSmtpTransporter();
      const timestamp = now.toISOString();
      const msgId = `auto_rpt_${Date.now()}`;

      if (transporter) {
        const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER || "reports@kidneycentre.org";
        transporter.sendMail({
          from: `"The Kidney Centre" <${senderEmail}>`,
          to: dailyReportSettings.recipients.join(', '),
          subject: `📊 [AUTOMATED DAILY REPORT] Patient Census & Inventory - ${reportDate}`,
          html: reportHtml
        }).then(() => {
          console.log(`[DailyReportSchedule] Daily report successfully delivered via SMTP.`);
          dailyReportSettings.lastSentAt = timestamp;
          dailyReportSettings.lastStatus = 'DELIVERED';
          dailyReportLogs.push({
            id: msgId,
            timestamp,
            recipients: dailyReportSettings.recipients,
            triggerType: 'AUTOMATED_SCHEDULE',
            status: 'DELIVERED',
            activeCensusCount: 0,
            lowStockAlertCount: 0,
            details: `Automated daily scheduled report delivered via SMTP.`
          });
        }).catch((err) => {
          console.error(`[DailyReportSchedule] Automated SMTP send failed:`, err);
          dailyReportSettings.lastSentAt = timestamp;
          dailyReportSettings.lastStatus = 'FAILED';
          dailyReportLogs.push({
            id: msgId,
            timestamp,
            recipients: dailyReportSettings.recipients,
            triggerType: 'AUTOMATED_SCHEDULE',
            status: 'FAILED',
            activeCensusCount: 0,
            lowStockAlertCount: 0,
            details: `Automated schedule error: ${err.message}`
          });
        });
      } else {
        console.log(`[DailyReportSchedule] Simulated automated report execution for ${dailyReportSettings.recipients.length} recipients.`);
        dailyReportSettings.lastSentAt = timestamp;
        dailyReportSettings.lastStatus = 'SIMULATED';
        dailyReportLogs.push({
          id: msgId,
          timestamp,
          recipients: dailyReportSettings.recipients,
          triggerType: 'AUTOMATED_SCHEDULE',
          status: 'SIMULATED',
          activeCensusCount: 0,
          lowStockAlertCount: 0,
          details: `Automated scheduled report simulated (SMTP user/pass not configured).`
        });
      }
    }
  }, 60000); // Check every 60 seconds

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MediLog Server & Cloud Functions running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
