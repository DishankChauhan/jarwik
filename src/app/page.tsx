import VoiceAgent from '@/components/VoiceAgent';
import { Text_03 } from '@/components/ui/wave-text';
import { RetroGrid } from '@/components/ui/retro-grid';

export default function Home() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden w-full">
      {/* Retro Grid Background */}
      <RetroGrid className="z-10" />
      
      {/* Orange dot patterns - Left side */}
      <div className="fixed left-0 top-0 w-1/2 h-full pointer-events-none z-20">
        <div className="absolute inset-0" 
             style={{
               backgroundImage: `radial-gradient(circle, #f97316 1px, transparent 1px)`,
               backgroundSize: '24px 24px',
               backgroundPosition: '0 0, 12px 12px',
               opacity: 0.15,
               maskImage: 'linear-gradient(to right, transparent, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.3) 80%, transparent)',
               WebkitMaskImage: 'linear-gradient(to right, transparent, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.3) 80%, transparent)'
             }}>
        </div>
      </div>

      {/* Orange dot patterns - Right side */}
      <div className="fixed right-0 top-0 w-1/2 h-full pointer-events-none z-20">
        <div className="absolute inset-0" 
             style={{
               backgroundImage: `radial-gradient(circle, #f97316 1px, transparent 1px)`,
               backgroundSize: '24px 24px',
               backgroundPosition: '0 0, 12px 12px',
               opacity: 0.15,
               maskImage: 'linear-gradient(to left, transparent, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.3) 80%, transparent)',
               WebkitMaskImage: 'linear-gradient(to left, transparent, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.3) 80%, transparent)'
             }}>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-30 min-h-screen flex flex-col bg-transparent">
        {/* Hero Section */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-4xl mx-auto px-6 lg:px-8">
            {/* Animated Text */}
            <div className="mb-12">
              <div className="max-w-3xl mx-auto">
                <Text_03 
                  text="Jarwik is all set to talk with you!"
                  className="text-gray-700 text-lg font-medium leading-relaxed"
                />
              </div>
            </div>

            {/* Voice Agent */}
            <div className="flex justify-center mb-16">
              <VoiceAgent />
            </div>

            {/* Email Signup Section - Moved up */}
            <div className="max-w-md mx-auto">
              <div className="flex rounded-full border border-gray-200 p-1 bg-gray-50">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-full border-0 bg-transparent focus:outline-none focus:ring-0 text-gray-900 placeholder-gray-500"
                />
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full font-medium transition-colors duration-200">
                  Claim Invite!
                </button>
              </div>
              
              <div className="text-center mt-4">
                <p className="text-gray-600 text-sm">
                  — We are <span className="text-orange-500 font-semibold">400+</span> people in our{' '}
                  <span className="font-semibold">Waitlist</span>, join now!
                </p>
                <p className="text-orange-400 text-xs mt-1">coming this 7th July!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
