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
            const specialCharacters = ['●', '►', '•', '◦'];
      
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: extractedText
              .split('\n')
              .map(line => line.trim()) // Trim each line to remove leading/trailing spaces
              .reduce((acc, curr) => {
                // Merge lines where mathematical expressions are split
                if (
                  /^[a-zA-Z]+\s*$/.test(curr) && acc.length > 0 || // Single variable or identifier
                  /^[=+\-*/^(){}\[\]∑√π∞⋅∫≤≥≈≠±×÷≤≥∂∆∇∅≡∀∃∴∵⊕⊗∪∩⊆⊇∈∉∅⊂⊃∴∵⟶⟵∠∥∦]+$/.test(curr) || // Just mathematical symbols
                  /[a-zA-Z0-9]$/.test(acc[acc.length - 1]) && /^[a-zA-Z0-9]/.test(curr) // Continuation of a number or letter
                ) {
                  acc[acc.length - 1] += ' ' + curr;
                } else {
                  acc.push(curr);
                }
                return acc;
              }, [])
              .join(' ') // Join all lines into one paragraph to handle long expressions
              .split(new RegExp(`(${specialCharacters.join('|')})`)) // Split by special characters
              .filter(part => part.trim() !== '') // Remove empty parts
              .map(part => {
                // Step 1: Normalize and clean up text
                let normalizedText = part
                  .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove unwanted control characters
                  .normalize('NFC');
      
                // Step 2: Fix specific mathematical formatting issues
                normalizedText = normalizedText
                  .replace(/\s*([=+\-*/^(){}\[\]∑√π∞⋅∫≤≥≈≠±×÷≤≥∂∆∇∅≡∀∃∴∵⊕⊗∪∩⊆⊇∈∉∅⊂⊃∴∵⟶⟵∠∥∦])\s*/g, ' $1 ') // Ensure spacing around symbols
                  .replace(/\s*-\s*/g, ' - ') // Handle minus sign spacing
                  .replace(/\s*\+\s*/g, ' + ') // Handle plus sign spacing
                  .replace(/\s*=\s*/g, ' = ') // Handle equal sign spacing
                  .replace(/\s+/, ' ') // Replace multiple spaces with a single space
                  .replace(/([a-zA-Z])\s*(\d+)/g, '$1$2') // Join letter-number combinations like x 1 -> x1
                  .replace(/(\d+)\s*([a-zA-Z])/g, '$1$2') // Join number-letter combinations like 2 x -> 2x
                  .replace(/\(\s+/g, '(') // Remove space after opening parenthesis
                  .replace(/\s+\)/g, ')') // Remove space before closing parenthesis
                  .replace(/([a-zA-Z])\s*\(\s*([a-zA-Z0-9])/g, '$1($2') // Join letter and parenthesis: f ( x ) -> f(x)
                  .replace(/([a-zA-Z0-9])\s*\)\s*([a-zA-Z0-9])/g, '$1) $2') // Join parenthesis and next term: f(x) y -> f(x) y
                  .replace(/\s*\)\s*-\s*\(/g, ') - ('); // Format subtraction between parentheses
      
                return new Paragraph({
                  children: [
                    new TextRun({
                      text: normalizedText.trim(),
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
