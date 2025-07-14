const vision = require('@google-cloud/vision');

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse the request body
    const { imageData } = JSON.parse(event.body);
    
    if (!imageData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image data provided' }),
      };
    }

    // Initialize Google Vision client with credentials from environment
    const client = new vision.ImageAnnotatorClient({
      credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
    });

    // Convert base64 image to buffer
    const imageBuffer = Buffer.from(imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

    // Perform text detection
    const [result] = await client.textDetection({
      image: { content: imageBuffer }
    });

    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'No text detected in image',
          grid: getDefaultBingoCard()
        }),
      };
    }

    // Extract text and parse bingo numbers
    const fullText = detections[0].description;
    const bingoGrid = parseBingoText(fullText);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        grid: bingoGrid,
        detectedText: fullText 
      }),
    };

  } catch (error) {
    console.error('OCR processing error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'OCR processing failed',
        grid: getDefaultBingoCard()
      }),
    };
  }
};

function parseBingoText(text) {
  try {
    // Remove extra whitespace and split into tokens
    const tokens = text.replace(/\s+/g, ' ').trim().split(/\s+/);
    const numbers = [];
    
    // Extract numbers and FREE spaces
    for (let token of tokens) {
      if (token.toUpperCase().includes('FREE')) {
        numbers.push('FREE');
      } else {
        const num = parseInt(token);
        if (!isNaN(num) && num >= 1 && num <= 75) {
          numbers.push(num);
        }
      }
    }

    // Validate we have reasonable bingo card data
    const freeCount = numbers.filter(n => n === 'FREE').length;
    if (numbers.length >= 20 && freeCount === 1) {
      // Arrange into 5x5 grid
      const grid = [];
      let index = 0;
      
      for (let row = 0; row < 5; row++) {
        grid[row] = [];
        for (let col = 0; col < 5; col++) {
          if (index < numbers.length) {
            grid[row][col] = numbers[index++];
          } else {
            // Fill missing spots with appropriate column numbers
            const columnRanges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
            const [min, max] = columnRanges[col];
            grid[row][col] = Math.floor(Math.random() * (max - min + 1)) + min;
          }
        }
      }
      
      return grid;
    } else {
      // Fallback to default card if parsing fails
      return getDefaultBingoCard();
    }
    
  } catch (error) {
    console.error('Text parsing error:', error);
    return getDefaultBingoCard();
  }
}

function getDefaultBingoCard() {
  // Generate a valid bingo card with proper column ranges
  const card = [];
  const columnRanges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
  
  for (let row = 0; row < 5; row++) {
    card[row] = [];
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        card[row][col] = 'FREE';
      } else {
        const [min, max] = columnRanges[col];
        card[row][col] = Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }
  }
  
  return card;
}
