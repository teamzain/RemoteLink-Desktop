import React from 'react'

const ProductTestimonialsSection: React.FC = () => {
  const tweets = [
    {
      username: '@sharathpatali',
      name: 'Sharath Patali',
      content: 'Setting up remote access on all my devices was so damn easy thanks to @Remote365. A tightly sealed network of remote devices with almost no configuration and also ease of adding a new device is just what I wanted. Amazing work @Remote365!'
    },
    {
      username: '@simonw',
      name: 'Simon Willison',
      content: 'OK yeah @Remote365 is good. This morning I got it running on my iPhone and a Linux server JUST using my phone and they\'re now connected. Just got it running on my Mac too, so now it\'s a three-device setup. Completely free, took minutes.'
    },
    {
      username: '@danp128',
      name: 'Dan Peterson',
      content: 'I\'ve used other remote desktop tools for ages — and I\'m now seriously considering switching fully to @Remote365 because it does everything I want ... and has stuff I never quite got to work right elsewhere. No muss, no fuss; excellent.'
    },
    {
      username: '@plasticine',
      name: 'Justin Morris',
      content: 'Geez @Remote365 is just flat-out good technology 😍 The implications for improving developer and operator experience dramatically. The more I play with it the more impressed I am. Excellent tooling for remote support.'
    },
    {
      username: '@jashankj',
      name: 'Jashank Jeremy',
      content: 'The session code feature in @Remote365 is brilliant — I can help my parents with their computer issues without them needing an account. Just send a code, they join, and I\'m in. Game changer for family tech support.'
    }
  ]

  const TweetCard: React.FC<{ tweet: typeof tweets[0] }> = ({ tweet }) => (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '20.25px 21px 21px',
        width: '400px',
        minWidth: '400px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        background: '#252222',
        flexShrink: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: 0,
          gap: '13px',
          width: '100%'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
            width: '100%'
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            {tweet.username[1].toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '15px',
                lineHeight: '22px',
                letterSpacing: '-0.15px',
                color: '#FFFFFF',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {tweet.username}
            </div>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '13px',
                lineHeight: '20px',
                letterSpacing: '-0.16px',
                color: 'rgba(255, 255, 255, 0.4)'
              }}
            >
              {tweet.name}
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: '22px',
            letterSpacing: '-0.48px',
            color: '#FFFFFF'
          }}
        >
          {tweet.content}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '24px',
          marginTop: '21px',
          flexWrap: 'wrap'
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            lineHeight: '20px',
            letterSpacing: '-0.16px',
            color: 'rgba(255, 255, 255, 0.54)',
            cursor: 'pointer'
          }}
        >
          Reply
        </span>
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            lineHeight: '20px',
            letterSpacing: '-0.16px',
            color: 'rgba(255, 255, 255, 0.54)',
            cursor: 'pointer'
          }}
        >
          Share
        </span>
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            lineHeight: '20px',
            letterSpacing: '-0.16px',
            color: 'rgba(255, 255, 255, 0.54)',
            cursor: 'pointer'
          }}
        >
          ...
        </span>
      </div>
    </div>
  )

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 0,
        width: '100%',
        minHeight: 'auto',
        background: '#252222',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <style>
        {`
          @keyframes marqueeLeft {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes marqueeRight {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          .marquee-row {
            display: flex;
            gap: 24px;
            width: fit-content;
            animation: marqueeLeft 40s linear infinite;
          }
          .marquee-row.reverse {
            animation: marqueeRight 40s linear infinite;
          }
          .marquee-row.blur {
            filter: blur(2px);
            opacity: 0.6;
          }
          .marquee-row:hover {
            animation-play-state: paused;
          }
        `}
      </style>

      {/* Top gradient fade */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '100px',
          background: 'linear-gradient(180deg, #252222 0%, rgba(37, 34, 34, 0) 100%)',
          zIndex: 1,
          pointerEvents: 'none'
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '120px 0 80px',
          isolation: 'isolate',
          width: '100%',
          maxWidth: '1440px',
          gap: '24px'
        }}
      >
        {/* Row 1 - Marquee left to right */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <div className="marquee-row">
            {[...tweets, ...tweets].map((tweet, index) => (
              <TweetCard key={`row1-${index}`} tweet={tweet} />
            ))}
          </div>
        </div>

        {/* Row 2 - Marquee right to left */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <div className="marquee-row reverse">
            {[...tweets.slice(2), ...tweets.slice(0, 2), ...tweets.slice(2), ...tweets.slice(0, 2)].map((tweet, index) => (
              <TweetCard key={`row2-${index}`} tweet={tweet} />
            ))}
          </div>
        </div>

        {/* Row 3 - Marquee left to right with blur */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <div className="marquee-row blur">
            {[...tweets.slice(1), ...tweets.slice(0, 1), ...tweets.slice(1), ...tweets.slice(0, 1)].map((tweet, index) => (
              <TweetCard key={`row3-${index}`} tweet={tweet} />
            ))}
          </div>
        </div>

        {/* Get involved section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 20px 0',
            width: '100%',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              width: '100%',
              maxWidth: '671px'
            }}
          >
            <h2
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: 'clamp(28px, 5vw, 36px)',
                lineHeight: '1.17',
                letterSpacing: '-0.72px',
                color: '#FFFFFF',
                margin: 0
              }}
            >
              Get involved
            </h2>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: 'clamp(16px, 2vw, 18px)',
                lineHeight: '1.5',
                letterSpacing: '-0.18px',
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0
              }}
            >
              We're always amazed how creative Remote 365 users are. If you'd like to share how you're using Remote 365, tweet us @remote365 or tag us in your posts.
            </p>
            <a
              href="#"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '12px 24px',
                gap: '11px',
                background: '#FFFFFF',
                border: '1px solid #FFFFFF',
                borderRadius: '8px',
                transition: 'opacity 0.2s',
                width: 'auto'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '16px',
                  lineHeight: '23px',
                  letterSpacing: '-0.16px',
                  color: '#302C2C',
                  whiteSpace: 'nowrap'
                }}
              >
                Explore our developer community
              </span>
              <svg width="16" height="18" viewBox="0 0 16 18" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 9H14M14 9L7 2M14 9L7 16" stroke="#302C2C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '100px',
          background: 'linear-gradient(0deg, #252222 0%, rgba(37, 34, 34, 0) 100%)',
          zIndex: 1,
          pointerEvents: 'none'
        }}
      />
    </section>
  )
}

export default ProductTestimonialsSection
