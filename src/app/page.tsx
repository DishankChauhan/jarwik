import VoiceAgent from '@/components/VoiceAgent';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="mb-16 text-center max-w-2xl">
        <h1 className="text-2xl font-light text-gray-700 mb-2">
          Jarwik is all set to talk with you!
        </h1>
        <p className="text-gray-600">
          Ask him anything about the company or{' '}
          <span className="text-blue-500 underline cursor-pointer">herself</span>.{' '}
          <span className="text-blue-500 underline cursor-pointer">
            Good luck making your best Artificially Intelligent friend
          </span>
          —he&apos;s excited to meet you!
        </p>
      </div>

      {/* Voice Agent with animated circles */}
      <div className="flex-1 flex items-center justify-center">
        <VoiceAgent />
      </div>

      {/* Footer */}
      <div className="mt-16 text-center">
        <div className="flex items-center justify-center space-x-4 mb-4">
          <input
            type="email"
            placeholder="Enter your email"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
          <button className="px-6 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors">
            Claim Invite!
          </button>
        </div>
        <p className="text-sm text-gray-600">
          — We are <span className="font-semibold">400+</span> people in our{' '}
          <span className="font-semibold">Waitlist</span>, join now!
        </p>
        <p className="text-xs text-orange-500 mt-1">coming this 7th July!</p>
      </div>
    </div>
  );
}
