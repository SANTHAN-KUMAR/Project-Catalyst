const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const promptLib = require('../shared/promptOptimizationLib');

const app = express();
app.use(express.json({ limit: '10mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'document-analysis-agent' });
});

app.post('/analyze', async (req, res) => {
  try {
    console.log('[Document Analysis Agent] Starting document analysis...');
    
    const { imageBase64, documentType } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const promptData = promptLib.getActivePrompt('documentAnalysis');
    console.log(`[Document Analysis Agent] Using prompt version: ${promptData.version}`);

    // Use the correct model name: gemini-1.5-flash-latest
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Analyze this receipt/bill/invoice document and extract:
1. Merchant/Vendor name
2. Date of transaction
3. Total amount
4. Currency
5. Line items with descriptions and prices
6. Whether this appears to be a legitimate business expense

Format the response as JSON.`;

    const imageParts = [{
      inlineData: {
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        mimeType: 'image/jpeg'
      }
    }];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    console.log('[Document Analysis Agent] ✓ Analysis complete');

    const inputHash = promptLib.createInputHash(imageBase64.substring(0, 100));
    await promptLib.logPromptUsage(promptData.version, inputHash, 'success');

    res.json({
      success: true,
      analysis: text,
      summary: 'Document analyzed successfully',
      promptVersion: promptData.version
    });

  } catch (error) {
    console.error('[Document Analysis Agent] Error during analysis:', error.message);
    res.status(500).json({ 
      error: 'Analysis failed', 
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, async () => {
  console.log(`Document Analysis Agent listening on port ${PORT}`);
  console.log('=== Prompt Optimization Enabled ===');
  await promptLib.initializeDatabase();
  console.log('✓ Prompt tracking database: READY');
  const promptData = promptLib.getActivePrompt('documentAnalysis');
  console.log(`✓ Active prompt version: ${promptData.version}`);
  const accuracy = await promptLib.getPromptAccuracy();
  console.log(`✓ Prompt accuracy: ${Math.round(accuracy)}%`);
  console.log('=============================');
});
