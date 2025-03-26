import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Default Anthropic model to use
const DEFAULT_MODEL = 'claude-3-haiku-20240307';

export async function POST(req: NextRequest) {
  try {
    // Extract parameters from the request
    const { prompt, rowData, batchData, isBatch, model = DEFAULT_MODEL } = await req.json();

    // Batch processing request
    if (isBatch && batchData && Array.isArray(batchData)) {
      if (!prompt) {
        return NextResponse.json(
          { error: 'Missing required field: prompt' },
          { status: 400 }
        );
      }

      try {
        console.log(`Using Anthropic model ${model} for batch processing of ${batchData.length} items`);

        // Build a more efficient batch processing prompt
        const combinedPrompt = `
I need you to process the following ${batchData.length} data records and generate content for each record.
Please process them strictly in order and keep each result separate.
For each record, generate content according to this prompt: ${prompt}

Data records:
${batchData.map((data, index) => `Record ${index + 1}: ${JSON.stringify(data)}`).join('\n')}

Please return your answers in JSON array format, with each element corresponding to the generated content for one record. Format as follows:
["Answer for record 1", "Answer for record 2", "Answer for record 3", ...]
Ensure the output is valid JSON and each record's answer is an independent string.
`;

        // Call Anthropic API for batch generation
        const response = await anthropic.messages.create({
          model: model,
          max_tokens: 4000, // Increase token limit to handle batch requests
          temperature: 0.7,
          system: "You are a helpful assistant that generates content based on spreadsheet data. Always return results in the exact format requested.",
          messages: [
            {
              role: "user",
              content: combinedPrompt
            }
          ],
        });

        // Extract generated content
        let generatedContent = 'No content generated';
        let batchResults: string[] = [];

        if (response.content && response.content.length > 0) {
          const firstBlock = response.content[0];
          if ('text' in firstBlock) {
            generatedContent = firstBlock.text;

            // Try to parse JSON array from the response
            try {
              // Find start and end positions of the JSON array
              const jsonStart = generatedContent.indexOf('[');
              const jsonEnd = generatedContent.lastIndexOf(']') + 1;

              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                const jsonString = generatedContent.substring(jsonStart, jsonEnd);
                const parsedResults = JSON.parse(jsonString);

                if (Array.isArray(parsedResults)) {
                  batchResults = parsedResults;
                  // Ensure the number of results matches the input count
                  if (batchResults.length < batchData.length) {
                    batchResults = [...batchResults, ...Array(batchData.length - batchResults.length).fill('Failed to generate content')];
                  } else if (batchResults.length > batchData.length) {
                    batchResults = batchResults.slice(0, batchData.length);
                  }
                }
              }
            } catch (parseError) {
              console.error('Error parsing JSON from response:', parseError);
              // If parsing fails, return error message
              batchResults = Array(batchData.length).fill('Unable to parse generated content');
            }
          } else {
            // If not a text block, return type information
            generatedContent = `[Content type: ${firstBlock.type}]`;
            batchResults = Array(batchData.length).fill(generatedContent);
          }
        } else {
          batchResults = Array(batchData.length).fill('No content generated');
        }

        // If parsing failed or results are empty, ensure we have results equal to input data count
        if (batchResults.length === 0) {
          batchResults = Array(batchData.length).fill('Failed to generate batch content');
        }

        return NextResponse.json({
          success: true,
          generatedContent, // Keep original content for debugging
          batchResults,     // Add batch results array
          provider: 'anthropic',
          model: model
        });
      } catch (apiError) {
        console.error('Anthropic API error in batch processing:', apiError);

        // If an error occurs, return response with error details
        return NextResponse.json(
          {
            error: 'Failed to generate batch content with Anthropic',
            details: apiError instanceof Error ? apiError.message : 'Unknown API error',
            provider: 'anthropic',
            batchResults: Array(batchData.length).fill('API error occurred')
          },
          { status: 500 }
        );
      }
    }
    // Process single record request (keep original logic for backward compatibility)
    else if (!prompt || !rowData) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt and rowData' },
        { status: 400 }
      );
    } else {
      try {
        console.log('Using Anthropic model:', model);

        // Call Anthropic API to generate content
        const response = await anthropic.messages.create({
          model: model,
          max_tokens: 1000,
          temperature: 0.7,
          system: "You are a helpful assistant that generates content based on spreadsheet data.",
          messages: [
            {
              role: "user",
              content: `Based on the following data: ${JSON.stringify(rowData)}, ${prompt}`
            }
          ],
        });

        // Extract generated content
        let generatedContent = 'No content generated';
        if (response.content && response.content.length > 0) {
          const firstBlock = response.content[0];
          if ('text' in firstBlock) {
            generatedContent = firstBlock.text;
          } else {
            // If not a text block, return type information
            generatedContent = `[Content type: ${firstBlock.type}]`;
          }
        }

        return NextResponse.json({
          success: true,
          generatedContent,
          provider: 'anthropic',
          model: model
        });
      } catch (apiError) {
        console.error('Anthropic API error:', apiError);

        // If an error occurs, return response with error details
        return NextResponse.json(
          {
            error: 'Failed to generate content with Anthropic',
            details: apiError instanceof Error ? apiError.message : 'Unknown API error',
            provider: 'anthropic'
          },
          { status: 500 }
        );
      }
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