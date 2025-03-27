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
    const { existingColumns, newColumnName, model = DEFAULT_MODEL } = await req.json();

    if (!existingColumns || !Array.isArray(existingColumns) || !newColumnName) {
      return NextResponse.json(
        { error: 'Missing required fields: existingColumns (array) and newColumnName' },
        { status: 400 }
      );
    }

    try {
      console.log(`Using Anthropic model ${model} for generating prompt recommendations`);

      // Build prompt for recommendation generation
      const systemPrompt = `You are an expert data analyst who helps users generate valuable insights from their data.
Your task is to recommend prompts for generating new data columns in tables.`;

      const userPrompt = `I have a table with the following columns:
${existingColumns.map(col => `- ${col}`).join('\n')}

I want to add a new column named "${newColumnName}".

Provide exactly 5 different, useful prompt suggestions for what this new column could contain based on the existing columns. 
These prompts should be written in English and should be clear instructions for an LLM to generate the column values.
Each prompt should be descriptive and specific, explaining what to generate and how it relates to the existing columns.
Just list the 5 numbered prompt suggestions without any additional explanations or comments. Don't include any preamble.`;

      // Call Anthropic API for recommendations
      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 1000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ],
      });

      // Extract generated recommendations
      let recommendations: string[] = [];

      if (response.content && response.content.length > 0) {
        const firstBlock = response.content[0];
        if ('text' in firstBlock) {
          // Parse the response text to extract the numbered recommendations
          const text = firstBlock.text.trim();

          // Split by numbered lines (1. 2. 3. etc)
          const lines = text.split(/\d+\.\s+/);

          // First item will be empty if the text starts with a number, so filter it out
          recommendations = lines
            .filter(line => line.trim().length > 0)
            .map(line => line.trim())
            .slice(0, 5); // Ensure we only get 5 recommendations

          // If we didn't get 5 recommendations using the above method, try line by line
          if (recommendations.length < 5) {
            recommendations = text
              .split('\n')
              .filter(line => line.trim().length > 0 && /^\d+\./.test(line.trim()))
              .map(line => line.replace(/^\d+\.\s*/, '').trim())
              .slice(0, 5);
          }

          // Ensure we have exactly 5 recommendations
          if (recommendations.length < 5) {
            recommendations = [
              ...recommendations,
              ...Array(5 - recommendations.length).fill("Generate insights from the existing data")
            ];
          } else if (recommendations.length > 5) {
            recommendations = recommendations.slice(0, 5);
          }
        }
      }

      return NextResponse.json({
        success: true,
        recommendations,
        provider: 'anthropic',
        model: model
      });
    } catch (apiError) {
      console.error('Anthropic API error in recommendations:', apiError);

      return NextResponse.json(
        {
          error: 'Failed to generate recommendations with Anthropic',
          details: apiError instanceof Error ? apiError.message : 'Unknown API error',
          provider: 'anthropic',
          recommendations: []
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in recommendations generation:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
        recommendations: []
      },
      { status: 500 }
    );
  }
}