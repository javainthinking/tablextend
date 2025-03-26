# Tablextend

Tablextend is a powerful tool that allows you to enhance spreadsheet data with AI-generated content. Upload your CSV or Excel file, define AI prompts to analyze your data, and generate new columns with valuable insights.

## Features

- 📊 Upload CSV and Excel spreadsheets
- 🤖 Use AI to analyze spreadsheet data and generate new columns
- 👁️ Preview AI-generated content before applying it to your entire dataset
- 📥 Download the enhanced spreadsheet with new AI-generated columns

## Getting Started

### Prerequisites

- Node.js (>= 18.x)
- npm or pnpm

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd tablextend
```

2. Install dependencies:

```bash
npm install
# or
pnpm install
```

3. Set up environment variables:

Create a `.env` file based on the `.env.example`:

```bash
cp .env.example .env
```

Then edit the `.env` file to add your Anthropic API key:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

You can get an API key from [Anthropic's platform](https://console.anthropic.com/).

### Development

Run the development server:

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## How to Use

1. **Upload a File**: Drag and drop a CSV or Excel file, or click to upload.
2. **Define a New Column**: 
   - Enter a name for the new column
   - Specify where to insert it
   - Write an AI prompt that explains what to generate
3. **Generate Preview**: Click "Generate Preview" to see AI-generated content for the first few rows
4. **Review and Approve**: Review the preview data and click "Approve & Generate All" to process all rows
5. **Download**: Download your enhanced spreadsheet with the new AI-generated column

## Examples of AI Prompts

- "Generate a summary of the customer feedback in the 'Comments' column"
- "Analyze the sentiment of the text in the 'Review' column (positive, negative, or neutral)"
- "Extract key topics from the 'Description' column"
- "Create a personalized response to the customer based on their 'Issue' and 'History' columns"

## Performance Considerations

- Large files with many rows will require more API calls and processing time
- The application processes data in batches to avoid overwhelming the API
- For very large files, consider using a more specialized tool

## License

This project is licensed under the MIT License - see the LICENSE file for details.
