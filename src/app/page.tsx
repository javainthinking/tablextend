import FileUploaderWrapper from '../components/FileUploaderWrapper'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto px-6 py-16 max-w-6xl">
        {/* Logo and Title Section */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center mb-12">
            <div className="logo-icon rounded-full p-3 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold logo-text">TableXtend</h1>
            <div className="ml-4 transform rotate-6 animate-pulse-slow">
              <div className="bg-gradient-to-r from-[#ff5e62] to-[#ff9966] text-white px-3 py-1 rounded-lg font-bold shadow-lg border-2 border-white text-sm">
                FREE
              </div>
            </div>
          </div>

          {/* Hero Content with Gradient Text */}
          <h2 className="text-6xl md:text-7xl font-bold mb-6 text-center tracking-tight leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#420039] via-[#9140c9] to-[#48a3a6]">
              Enrich Your Table with AI
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8 text-center leading-relaxed">
            Add new data into your table with AI – without scripts or code.
          </p>
          {/* Featured Description Badge */}
          <div className="mb-16 flex justify-center">
            <div className="inline-flex items-center py-2 px-4 bg-gradient-to-r from-[#420039]/10 via-[#9140c9]/10 to-[#48a3a6]/10 rounded-full border border-[#9140c9]/20">
              <span className="mr-2 bg-gradient-to-r from-[#420039] to-[#9140c9] rounded-full p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#420039] via-[#9140c9] to-[#48a3a6]">
                One of the best free Excel/CSV data generation AI tools
              </span>
            </div>
          </div>
        </div>

        {/* File Size Notice */}
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center bg-blue-50 text-blue-800 px-6 py-4 rounded-lg">
            <div className="flex items-center mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">Maximum file size is 5MB</span>
            </div>
            <div className="text-sm flex items-center justify-center mt-1">
              For files larger than 5MB (up to 1GB), please use{" "}
              <a
                href="https://powerdrill.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:underline flex items-center ml-1"
              >
                <Image
                  src="/powerdrill_logo_color.png"
                  alt="powerdrill.ai logo"
                  width={100}
                  height={40}
                  className="inline-block"
                />
                <span className="ml-2 text-[#420039]">powerdrill.ai</span>
              </a>
            </div>
          </div>
        </div>

        {/* File Uploader */}
        <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 mb-20">
          <FileUploaderWrapper />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>© 2025 Tablextend. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
