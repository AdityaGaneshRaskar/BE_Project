import React, { useState } from 'react';
import { Upload, Mic, Video, TrendingUp, Brain, Smile, CheckCircle, LogOut, User, Copy, Volume2, ArrowRight, Sparkles, BarChart3, MessageSquare } from 'lucide-react';
import Login from './Login';
import ProgressDashboard from './ProgressDashboard';

const ExtemporeSpeechEvaluator = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  
  // Topic and analysis flow
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [geminiSpeech, setGeminiSpeech] = useState('');
  const [comparison, setComparison] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    resetForm();
  };

  const resetForm = () => {
    setTopic('');
    setFile(null);
    setPreview(null);
    setResults(null);
    setGeminiSpeech('');
    setComparison(null);
    setShowComparison(false);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreview({ url, type: selectedFile.type });
    }
  };

  const handleAnalyze = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic first');
      return;
    }
    if (!file) {
      alert('Please upload your speech video/audio');
      return;
    }
    
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // Step 1: Analyze user's speech
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setResults(data);

        // Save to database if logged in
        if (user && !user.isGuest && user.userId) {
          await fetch('http://127.0.0.1:8000/save-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.userId,
              analysis_data: { ...data, filename: file.name, topic: topic }
            }),
          });
        }

        // Step 2: Generate Gemini's speech on the same topic
        const geminiResponse = await fetch('http://127.0.0.1:8000/generate-gemini-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: topic }),
        });

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          if (geminiData.success) {
            setGeminiSpeech(geminiData.speech);

            // Step 3: Compare speeches
            const compareResponse = await fetch('http://127.0.0.1:8000/compare-speeches', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_transcript: data.transcription,
                gemini_speech: geminiData.speech
              }),
            });

            if (compareResponse.ok) {
              const compareData = await compareResponse.json();
              setComparison(compareData.analysis);
            }
          }
        }
      } else {
        alert('Analysis failed. Please try again.');
      }
    } catch (error) {
      alert('Failed to connect to the server: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const speakText = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const RadarChart = ({ data, labels }) => {
    const size = 200;
    const center = size / 2;
    const maxRadius = 80;
    const numPoints = data.length;
    
    const points = data.map((value, i) => {
      const angle = (Math.PI * 2 * i) / numPoints - Math.PI / 2;
      const radius = (value / 10) * maxRadius;
      return {
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle)
      };
    });
    
    const pathData = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ') + ' Z';
    
    const gridLevels = [2, 4, 6, 8, 10];
    
    return (
      <svg width={size} height={size} className="mx-auto">
        <defs>
          <radialGradient id="radarGradient">
            <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#feca57" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        
        {gridLevels.map(level => {
          const levelPoints = Array(numPoints).fill(0).map((_, i) => {
            const angle = (Math.PI * 2 * i) / numPoints - Math.PI / 2;
            const radius = (level / 10) * maxRadius;
            return {
              x: center + radius * Math.cos(angle),
              y: center + radius * Math.sin(angle)
            };
          });
          
          const levelPath = levelPoints.map((p, i) => 
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
          ).join(' ') + ' Z';
          
          return (
            <path key={level} d={levelPath} fill="none" stroke="#333" strokeWidth="1" opacity="0.3" />
          );
        })}
        
        {points.map((_, i) => {
          const angle = (Math.PI * 2 * i) / numPoints - Math.PI / 2;
          const endX = center + maxRadius * Math.cos(angle);
          const endY = center + maxRadius * Math.sin(angle);
          return (
            <line key={i} x1={center} y1={center} x2={endX} y2={endY} stroke="#444" strokeWidth="1" />
          );
        })}
        
        <path d={pathData} fill="url(#radarGradient)" stroke="#feca57" strokeWidth="2" />
        
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#ff6b6b" />
        ))}
      </svg>
    );
  };

  // Show Login if not logged in
  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Show Progress Dashboard if requested
  if (showProgress) {
    return <ProgressDashboard user={user} onBack={() => setShowProgress(false)} />;
  }

  // Main App - Single Page Flow
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-700 bg-gray-900/50 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <Mic className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-yellow-500 bg-clip-text text-transparent">
                  Extempore Evaluator
                </h1>
                <p className="text-xs text-gray-400">AI-Powered Speech Analysis</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">{user?.username}</span>
                  {user?.isGuest && <span className="text-xs text-gray-500">(Guest)</span>}
                </div>
              </div>
              
              {!user?.isGuest && (
                <button 
                  onClick={() => setShowProgress(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 rounded-lg font-medium hover:shadow-lg transition-all flex items-center space-x-2 text-white"
                >
                  <span>📊</span>
                  <span>Progress</span>
                </button>
              )}
              
              <button onClick={handleLogout} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <LogOut className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        {!results ? (
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-8 space-y-4">
              <h2 className="text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 bg-clip-text text-transparent">
                  Elevate Your Speaking Skills
                </span>
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Enter your topic, record your speech, and get AI-powered feedback with a reference speech
              </p>
            </div>

            {/* Step 1: Enter Topic */}
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border-2 border-purple-500 mb-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center font-bold mr-3">1</div>
                <h3 className="text-2xl font-bold">Choose Your Topic</h3>
              </div>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Example: 'The impact of artificial intelligence on education' or 'Climate change solutions for the next decade'"
                className="w-full bg-gray-900/50 border border-purple-500 rounded-lg p-4 focus:outline-none focus:border-pink-500 transition-colors text-white placeholder-gray-500"
                rows="3"
              />
              <p className="text-sm text-gray-400 mt-2">
                💡 Tip: Be specific! Instead of "Technology", try "How AI is transforming healthcare diagnostics"
              </p>
            </div>

            {/* Step 2: Upload Speech */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 mb-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold mr-3">2</div>
                <h3 className="text-2xl font-bold">Upload Your Speech</h3>
              </div>
              
              <label className="block">
                <div className="border-2 border-dashed border-gray-600 rounded-xl p-12 hover:border-yellow-500 transition-all cursor-pointer bg-gray-900/50 hover:bg-gray-900">
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="text-center">
                    {!file ? (
                      <>
                        <Video className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                        <p className="text-gray-400">Click to browse or drag and drop your file here</p>
                        <p className="text-sm text-gray-500 mt-2">Support for audio (MP3, WAV) and video (MP4, MOV, AVI) files</p>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                        <p className="text-green-500 font-medium">{file.name}</p>
                        <p className="text-sm text-gray-400 mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    )}
                  </div>
                </div>
              </label>

              {preview && (
                <div className="mt-6 rounded-xl overflow-hidden bg-black">
                  {preview.type.startsWith('video') ? (
                    <video src={preview.url} controls className="w-full max-h-96" />
                  ) : (
                    <audio src={preview.url} controls className="w-full" />
                  )}
                </div>
              )}
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={!topic.trim() || !file || isAnalyzing}
              className="w-full bg-gradient-to-r from-pink-500 to-yellow-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-pink-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 flex items-center justify-center space-x-3"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span>Analyzing & Generating Reference Speech...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>Analyze & Get AI Reference Speech</span>
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>

            {/* Features Grid */}
            <div className="grid md:grid-cols-4 gap-6 mt-12">
              {[
                { icon: Brain, title: 'AI Feedback', desc: 'Detailed scoring on 5 metrics' },
                { icon: Mic, title: 'Transcription', desc: 'Whisper AI speech-to-text' },
                { icon: Smile, title: 'Gestures', desc: 'MediaPipe face analysis' },
                { icon: Sparkles, title: 'AI Reference', desc: 'Compare with expert speech' }
              ].map((feature, i) => (
                <div key={i} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-yellow-500 transition-all">
                  <feature.icon className="w-10 h-10 text-yellow-500 mb-3" />
                  <h4 className="font-bold mb-2">{feature.title}</h4>
                  <p className="text-sm text-gray-400">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* New Analysis Button */}
            <div className="flex justify-between items-center">
              <button
                onClick={resetForm}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors flex items-center space-x-2"
              >
                <span>← New Analysis</span>
              </button>
              
              {geminiSpeech && (
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center space-x-2"
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>{showComparison ? 'Hide' : 'Show'} Detailed Comparison</span>
                </button>
              )}
            </div>

            {/* Topic Display */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500">
              <p className="text-sm text-gray-400">Topic:</p>
              <p className="text-xl font-bold text-white">{topic}</p>
            </div>

            {/* Feedback Section */}
            {results.feedback && !results.feedback.Error && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <MessageSquare className="w-6 h-6 mr-3 text-yellow-500" />
                  AI Feedback on Your Speech
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(results.feedback).map(([category, details]) => (
                    <div key={category} className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-bold text-yellow-500">{category}</h3>
                        <span className="text-2xl font-bold text-pink-500">{details.score}/10</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                        <div
                          className="bg-gradient-to-r from-pink-500 to-yellow-500 h-2 rounded-full"
                          style={{ width: `${(details.score / 10) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-gray-300 mb-3 text-sm">{details.comment}</p>
                      {details.improvements && details.improvements.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-yellow-500">💡 Improvements:</p>
                          {details.improvements.map((imp, i) => (
                            <p key={i} className="text-xs text-gray-400">• {imp}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gemini's Reference Speech */}
            {geminiSpeech && (
              <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-2xl p-6 border-2 border-yellow-500">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold flex items-center">
                    <Sparkles className="w-6 h-6 mr-3 text-yellow-500" />
                    AI's Expert Speech on Same Topic
                  </h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(geminiSpeech)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => speakText(geminiSpeech)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      title="Listen"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="bg-gray-900/50 rounded-xl p-6 border border-yellow-700 max-h-96 overflow-y-auto">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{geminiSpeech}</p>
                </div>
                <p className="text-sm text-yellow-400 mt-4">
                  ✨ Study this structure and language to improve your next speech!
                </p>
              </div>
            )}

            {/* Detailed Comparison (Collapsible) */}
            {showComparison && comparison && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <BarChart3 className="w-6 h-6 mr-3 text-blue-500" />
                  Detailed Speech Comparison
                </h2>

                {/* Metrics */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Word Count</p>
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-purple-500">You: {comparison.word_count_user}</span>
                      <span className="text-yellow-500">AI: {comparison.word_count_gemini}</span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Vocabulary Level</p>
                    <div className="flex justify-between text-lg font-bold capitalize">
                      <span className="text-purple-500">{comparison.vocabulary_level_user}</span>
                      <span className="text-yellow-500">{comparison.vocabulary_level_gemini}</span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Engagement</p>
                    <p className="text-xs text-gray-300 mt-2">{comparison.engagement_level}</p>
                  </div>
                </div>

                {/* Key Points */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-purple-900/20 rounded-xl p-4 border border-purple-700">
                    <h3 className="font-bold text-purple-400 mb-3">Your Key Points</h3>
                    <ul className="space-y-2">
                      {comparison.user_key_points?.map((point, i) => (
                        <li key={i} className="text-sm text-gray-300">• {point}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-700">
                    <h3 className="font-bold text-yellow-400 mb-3">AI's Key Points</h3>
                    <ul className="space-y-2">
                      {comparison.gemini_key_points?.map((point, i) => (
                        <li key={i} className="text-sm text-gray-300">• {point}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Strengths & Improvements */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-green-900/20 rounded-xl p-4 border border-green-700">
                    <h3 className="font-bold text-green-400 mb-3">Your Strengths</h3>
                    <ul className="space-y-2">
                      {comparison.user_strengths?.map((strength, i) => (
                        <li key={i} className="text-sm text-gray-300">✓ {strength}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-orange-900/20 rounded-xl p-4 border border-orange-700">
                    <h3 className="font-bold text-orange-400 mb-3">Areas to Improve</h3>
                    <ul className="space-y-2">
                      {comparison.areas_to_improve?.map((area, i) => (
                        <li key={i} className="text-sm text-gray-300">→ {area}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Structure Analysis */}
                <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700 mb-8">
                  <h3 className="font-bold text-blue-400 mb-3">Structure Analysis</h3>
                  <p className="text-sm text-gray-300">{comparison.structure_analysis}</p>
                </div>

                {/* Recommendations */}
                <div className="bg-pink-900/20 rounded-xl p-4 border border-pink-700">
                  <h3 className="font-bold text-pink-400 mb-3">Recommendations for Next Time</h3>
                  <ul className="space-y-2">
                    {comparison.recommendations?.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-300">• {rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Side-by-Side Transcripts */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Your Transcript */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <Mic className="w-5 h-5 mr-2 text-purple-500" />
                  Your Speech Transcript
                </h3>
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 max-h-96 overflow-y-auto">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {results?.transcription || 'Transcription not available'}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(results?.transcription || '')}
                  className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Transcript</span>
                </button>
              </div>

              {/* AI Transcript */}
              {geminiSpeech && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                    AI Reference Transcript
                  </h3>
                  <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 max-h-96 overflow-y-auto">
             <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{geminiSpeech}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(geminiSpeech)}
                    className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Transcript</span>
                  </button>
                </div>
              )}
            </div>

            {/* Gesture Metrics */}
            {results.gesture_metrics && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                  <h3 className="text-2xl font-bold mb-4 flex items-center">
                    <Smile className="w-6 h-6 mr-3 text-yellow-500" />
                    Facial Gestures
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-gray-900/50 rounded-xl">
                      <span>Smile Score</span>
                      <span className="font-bold text-yellow-500">{results.gesture_metrics.smile_mean?.toFixed(3) || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gray-900/50 rounded-xl">
                      <span>Eyebrow Raise</span>
                      <span className="font-bold text-yellow-500">{results.gesture_metrics.eyebrow_raise_mean?.toFixed(3) || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gray-900/50 rounded-xl">
                      <span>Blink Count</span>
                      <span className="font-bold text-yellow-500">{results.gesture_metrics.blink_count || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gray-900/50 rounded-xl">
                      <span>Head Tilt</span>
                      <span className="font-bold text-yellow-500">{results.gesture_metrics.head_pose_mean?.toFixed(3) || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                  <h3 className="text-2xl font-bold mb-4 flex items-center">
                    <TrendingUp className="w-6 h-6 mr-3 text-yellow-500" />
                    Confidence & Nervousness
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-lg">💪 Confidence</span>
                        <span className="text-2xl font-bold text-green-500">
                          {((results.gesture_metrics.smile_mean || 0) * 10 - (results.gesture_metrics.head_pose_mean || 0) * 5).toFixed(1)}/10
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-4">
                        <div
                          className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full"
                          style={{ width: `${Math.max(0, Math.min(100, ((results.gesture_metrics.smile_mean || 0) * 100 - (results.gesture_metrics.head_pose_mean || 0) * 50)))}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-lg">😰 Nervousness</span>
                        <span className="text-2xl font-bold text-orange-500">
                          {((results.gesture_metrics.eyebrow_raise_mean || 0) * 5 + Math.min((results.gesture_metrics.blink_count || 0), 20) / 4 + (results.gesture_metrics.head_pose_mean || 0) * 5).toFixed(1)}/10
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-4">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-red-500 h-4 rounded-full"
                          style={{ width: `${Math.min(100, ((results.gesture_metrics.eyebrow_raise_mean || 0) * 50 + Math.min((results.gesture_metrics.blink_count || 0), 20) * 2.5 + (results.gesture_metrics.head_pose_mean || 0) * 50))}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-700 mt-12 py-6 text-center text-gray-400">
        <p>© 2025 Extempore Evaluator | Powered by AI</p>
      </footer>
    </div>
  );
};

export default ExtemporeSpeechEvaluator;      