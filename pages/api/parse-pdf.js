import { IncomingForm } from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse'; // For initial text extraction
import { createWorker } from 'tesseract.js'; // For OCR extraction from images
import { Document, Packer, Paragraph, TextRun } from 'docx';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      return res.status(500).json({ message: 'Error parsing the form' });
    }

    if (!files.file || !Array.isArray(files.file) || !files.file[0]) {
      return res.status(400).json({ message: 'No file uploaded or invalid file format' });
    }

    const filePath = files.file[0].filepath;

    try {
      // Step 1: Try to parse the PDF for text content
      const dataBuffer = fs.readFileSync(filePath);
      let extractedText = '';

      try {
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text.trim();
        console.log('Extracted Text:', extractedText);
      } catch (parseError) {
        console.error('Error extracting text from PDF:', parseError);
      }

      // Step 2: If no text is found, fallback to OCR
      if (!extractedText) {
        console.log('No text found, attempting OCR...');

        const worker = createWorker();
        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');

        // Use OCR to extract text from the image-based PDF
        const ocrResult = await worker.recognize(filePath);
        extractedText = ocrResult.data.text.trim();
        console.log('Extracted OCR Text:', extractedText);

        await worker.terminate();
      }

      // Step 3: If still no text, respond with an error
      if (!extractedText) {
        return res.status(500).json({ message: 'Unable to extract text from the PDF' });
      }

      // Step 4: Create a Word document from the extracted text
const doc = new Document({
  sections: [
    {
      properties: {},
      children: extractedText.split('\n').map((paragraph) => {
        const normalizedText = paragraph
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
          .normalize('NFC'); // Normalisation des caractères

        return new Paragraph({
          children: [
            new TextRun({
              text: normalizedText,
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        });
      }),
    },
  ],
});


      const buffer = await Packer.toBuffer(doc);

      res.setHeader('Content-Disposition', 'attachment; filename=converted_document.docx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Error processing PDF:', error);
      return res.status(500).json({ message: 'Error processing the PDF file' });
    }
  });
}
