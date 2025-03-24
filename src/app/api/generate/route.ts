import { NextRequest, NextResponse } from 'next/server';
// Keep OpenAI import commented out until it's needed
import OpenAI from 'openai';

// Initialize OpenAI client
// In production, you would use environment variables for the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_API_BASE_URL || 'http://10.71.9.80/v1', // 允许自定义API端点
});

export async function POST(req: NextRequest) {
  try {
    // Destructure only what we need from the request
    const { prompt, rowData } = await req.json();

    if (!prompt || !rowData) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt and rowData' },
        { status: 400 }
      );
    }

    // Call the OpenAI API
    try {
      const completion = await openai.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates content based on spreadsheet data."
          },
          {
            role: "user",
            content: `Based on the following data: ${JSON.stringify(rowData)}, 
                    ${prompt}`
          }
        ],
      });
      
      const generatedContent = completion.choices[0].message.content || 'No content generated';
      
      return NextResponse.json({ 
        success: true,
        generatedContent
      });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      
      // Fallback to simulated response if API call fails
      console.log('Falling back to simulated response');
      
      // For demo, create a simulated response based on the row data and prompt
      let generatedContent = `AI-generated content based on prompt: "${prompt}"`;
      
      // Add some variety to the generated content based on the data
      if (typeof rowData === 'object' && rowData !== null) {
        const keys = Object.keys(rowData);
        if (keys.length > 0) {
          const firstKey = keys[0];
          generatedContent += ` with reference to ${firstKey}: ${rowData[firstKey]}`;
        }
      }
      
      return NextResponse.json({ 
        success: true,
        generatedContent,
        note: "Using fallback response due to API error"
      });
    }
  } catch (error) {
    console.error('Error in AI generation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate content',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 