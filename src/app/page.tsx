import FileUploaderWrapper from '../components/FileUploaderWrapper'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#420039] shadow-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-full p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#420039]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">TableXtend</h1>
          </div>
          <div className="flex space-x-6">
            <a href="#pricing" className="text-sm text-white/90 hover:text-white">Pricing</a>
            <a href="#templates" className="text-sm text-white/90 hover:text-white">Templates</a>
            <a href="#community" className="text-sm text-white/90 hover:text-white">Community</a>
            <a href="#resources" className="text-sm text-white/90 hover:text-white">Resources</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-white/90 hover:text-white">GitHub</a>
          </div>
          <div className="flex items-center space-x-4">
            <a href="#signin" className="text-sm text-white hover:text-white/80">Sign in</a>
            <a href="#signup" className="bg-[#ffbc00] hover:bg-[#ffa700] text-[#420039] font-semibold px-4 py-2 rounded-md text-sm">Sign up for free</a>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        {/* Hero section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-[#420039] mb-4">
            Enrich Your Table with AI
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Add new data into your table with AI – without scripts or code.
          </p>
          <div className="flex justify-center space-x-4">
            <button className="bg-[#ffbc00] hover:bg-[#ffa700] text-[#420039] font-bold px-6 py-3 rounded-md text-base shadow-sm">
              Get Started
            </button>
            <button className="border border-gray-300 text-gray-700 px-6 py-3 rounded-md text-base flex items-center hover:bg-gray-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Watch demo
            </button>
          </div>
        </div>

        {/* File Uploader */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 mb-16">
          <h2 className="text-2xl font-bold text-[#420039] mb-6 text-center">
            Upload Your Data
          </h2>
          <FileUploaderWrapper />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-20">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>© 2025 Tablextend. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
