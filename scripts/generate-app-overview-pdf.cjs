/**
 * Generates a one-page PDF overview of JobDock
 * Run: node scripts/generate-app-overview-pdf.cjs
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'JobDock-Overview.pdf');
const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Colors (from JobDock palette)
const dark = '#0B132B';
const secondary = '#1C2541';
const blue = '#3A506B';
const gold = '#D4AF37';

// Title
doc.fontSize(28).fillColor(dark).font('Helvetica-Bold').text('JobDock', 50, 50);
doc.fontSize(12).fillColor(blue).font('Helvetica').text('Contractor Management Platform', 50, 82);

// What It Is
doc.fontSize(14).fillColor(dark).font('Helvetica-Bold').text('What It Is', 50, 115);
doc.fontSize(10).fillColor(secondary).font('Helvetica')
  .text('JobDock is a comprehensive SAAS platform built for trades and service professionals—contractors, landscapers, HVAC specialists, and similar businesses. It consolidates quotes, invoices, scheduling, and client management into one simple system designed around how service businesses actually work. No bloat, no learning curve.', 50, 132, { width: 515 });

// Core Capabilities
doc.fontSize(14).fillColor(dark).font('Helvetica-Bold').text('Core Capabilities', 50, 195);

const capabilities = [
  'Professional Quotes — Create and send polished quotes in minutes. No design skills needed.',
  'Fast Invoicing — Turn completed jobs into accurate invoices with one click. Quote-to-invoice conversion.',
  'Smart Scheduling — Manage bookings with day, week, and month calendar views.',
  'Client Management (CRM) — Contact details, job history, and notes in one place. Import from CSV.',
  'Public Booking — Share a link; clients book online 24/7. Calendly-style with configurable availability.',
  'Job Tracking — Track progress from lead to completion. Status visibility across your pipeline.',
  'Auto Email — Send quotes and invoices automatically. Professional delivery without manual work.',
  'Text Notifications — Send reminders, confirmations, and updates to clients via SMS.',
  'Job Logs — Track time logs, capture photos, and add notes on jobsites. Clock in/out, attach images with markup, and keep a timeline of updates per job.',
  'Reports & Time Tracking — Employee hours and business insights.',
  'Team & Settings — Company branding, PDF templates, team members, and profile management.',
];

let y = 215;
doc.fontSize(9).font('Helvetica');
capabilities.forEach((item) => {
  const lineHeight = doc.heightOfString(item, { width: 505 });
  doc.fillColor(gold).font('Helvetica-Bold').text('•', 50, y);
  doc.fillColor(secondary).font('Helvetica').text(item, 60, y, { width: 505 });
  y += lineHeight + 6;
});

y += 10;
doc.fontSize(14).fillColor(dark).font('Helvetica-Bold').text('How It Works', 50, y);
const howItWorksText = 'Add a client, send them a quote, and schedule the job once they approve. When the work is done, invoice with one click. Everything stays connected.';
y += 18;
doc.fontSize(9).fillColor(secondary).font('Helvetica').text(howItWorksText, 50, y, { width: 515 });
y += doc.heightOfString(howItWorksText, { width: 515 }) + 12;

doc.fontSize(14).fillColor(dark).font('Helvetica-Bold').text('Built For', 50, y);
const builtForText = 'Service businesses who need to get work done—without juggling spreadsheets, texts, and multiple tools.';
y += 18;
doc.fontSize(9).fillColor(secondary).font('Helvetica').text(builtForText, 50, y, { width: 515 });
y += doc.heightOfString(builtForText, { width: 515 }) + 10;

doc.fontSize(14).fillColor(dark).font('Helvetica-Bold').text('Tech Stack', 50, y);
const techStackText = 'React, TypeScript, Vite, Tailwind CSS, Zustand, React Hook Form, Zod. Backend: AWS Lambda, Prisma, PostgreSQL, Cognito, S3. Stripe, Resend, Twilio.';
y += 18;
doc.fontSize(9).fillColor(secondary).font('Helvetica').text(techStackText, 50, y, { width: 515 });

// Footer
doc.fontSize(8).fillColor(blue).font('Helvetica')
  .text('JobDock — Stop juggling tools. Run your jobs in one place.', 50, 720, { align: 'center', width: 515 });

doc.end();

stream.on('finish', () => {
  console.log(`PDF saved to: ${path.resolve(outputPath)}`);
});
