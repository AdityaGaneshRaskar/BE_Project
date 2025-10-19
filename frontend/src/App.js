import React, { useState } from 'react';
import { Upload, Mic, Video, TrendingUp, Brain, Smile, CheckCircle, LogOut, User } from 'lucide-react';
import Login from './Login';
import ProgressDashboard from './ProgressDashboard';

const ExtemporeSpeechEvaluator = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [showProgress, setShowProgress] = useState(false);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setFile(null);
    setPreview(null);
    setResults(null);
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
    if (!file) return;
    
    console.log('🎯 Starting analysis...');
    console.log('👤 User info:', user);
    
    setIsAnalyzing(true);
    setResults(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Analysis response:', data);
        
        const gestureMetrics = data.gesture_metrics || {};
        const confidence = data.confidence_score || calculateConfidence(gestureMetrics);
        const nervousness = data.nervousness_score || calculateNervousness(gestureMetrics);
        
        const resultsData = {
          ...data,
          confidence_score: confidence,
          nervousness_score: nervousness
        };
        
        setResults(resultsData);
        
        console.log('💾 Checking if should save to database...');
        console.log('Is Guest?', user?.isGuest);
        console.log('User ID:', user?.userId);
        
        if (user && !user.isGuest && user.userId) {
          console.log('💾 Attempting to save to database...');
          try {
            const saveResponse = await fetch('http://127.0.0.1:8000/save-analysis', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: user.userId,
                analysis_data: resultsData
              }),
            });
            
            console.log('💾 Save response status:', saveResponse.status);
            
            if (saveResponse.ok) {
              const saveData = await saveResponse.json();
              console.log('✅ Analysis saved to database:', saveData);
              alert('✅ Analysis saved to your history!');
            } else {
              const errorData = await saveResponse.text();
              console.error('❌ Save failed:', errorData);
              alert('⚠️ Analysis completed but not saved to history');
            }
          } catch (saveError) {
            console.error('⚠️ Could not save to database:', saveError);
            alert('⚠️ Could not save to database: ' + saveError.message);
          }
        } else {
          console.log('ℹ️ Guest user or no user ID - analysis not saved to database');
        }
      } else {
        alert('Analysis failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ Analysis error:', error);
      alert('Failed to connect to the server: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateConfidence = (metrics) => {
    const smile = metrics.smile_mean || 0;
    const headMovement = metrics.head_pose_mean || 0;
    let confidence = (smile * 10) - (headMovement * 5);
    return Math.max(0, Math.min(10, confidence));
  };

  const calculateNervousness = (metrics) => {
    const eyebrow = metrics.eyebrow_raise_mean || 0;
    const blink = Math.min(metrics.blink_count || 0, 20) / 20;
    const headMovement = metrics.head_pose_mean || 0;
    let nervousness = (eyebrow * 5 + blink * 5 + headMovement * 5);
    return Math.max(0, Math.min(10, nervousness));
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

  // Main App
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
            
            <div className="flex items-center space-x-4">
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
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 rounded-lg font-medium hover:shadow-lg transition-all flex items-center space-x-2"
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
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 bg-clip-text text-transparent">
                  Elevate Your Speaking Skills
                </span>
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Upload your speech and get instant AI-powered feedback on clarity, delivery, gestures, and confidence
              </p>
            </div>

            {/* Upload Card */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 shadow-2xl">
              <div className="text-center mb-6">
                <Upload className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                <h3 className="text-2xl font-bold mb-2">Upload Your Speech</h3>
                <p className="text-gray-400">Support for audio (MP3, WAV) and video (MP4, MOV, AVI) files</p>
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

              <button
                onClick={handleAnalyze}
                disabled={!file || isAnalyzing}
                className="w-full mt-6 bg-gradient-to-r from-pink-500 to-yellow-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-pink-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Analyzing Your Speech...
                  </span>
                ) : (
                  'Analyze Speech 🚀'
                )}
              </button>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-4 gap-6 mt-12">
              {[
                { icon: Brain, title: 'AI Analysis', desc: 'Powered by Gemini AI' },
                { icon: Mic, title: 'Speech-to-Text', desc: 'Whisper AI transcription' },
                { icon: Smile, title: 'Gesture Analysis', desc: 'MediaPipe detection' },
                { icon: TrendingUp, title: 'Detailed Metrics', desc: 'Comprehensive scoring' }
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
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={() => { setResults(null); setFile(null); setPreview(null); }}
              className="mb-4 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors flex items-center space-x-2"
            >
              <span>← New Analysis</span>
            </button>

            {/* Transcription */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-2xl font-bold mb-4 flex items-center">
                <Mic className="w-6 h-6 mr-3 text-yellow-500" />
                Transcription
              </h3>
              <div className="bg-gray-900/50 rounded-xl p-6 italic text-gray-300 border-l-4 border-yellow-500">
                "{results.transcription || 'No transcription available'}"
              </div>
            </div>

            {/* Feedback Dashboard */}
            {results.feedback && !results.feedback.Error && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-2xl font-bold mb-6 flex items-center">
                  <Brain className="w-6 h-6 mr-3 text-yellow-500" />
                  AI Feedback Dashboard
                </h3>

                <div className="grid lg:grid-cols-2 gap-8">
                  {/* Detailed Feedback */}
                  <div className="space-y-6">
                    {Object.entries(results.feedback).map(([category, details]) => (
                      <div key={category} className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xl font-bold text-yellow-500">{category}</h4>
                          <span className="text-2xl font-bold text-pink-500">{details.score}/10</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                          <div
                            className="bg-gradient-to-r from-pink-500 to-yellow-500 h-2 rounded-full transition-all"
                            style={{ width: `${(details.score / 10) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-gray-300 mb-3">{details.comment}</p>
                        {details.improvements && details.improvements.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm font-semibold text-yellow-500">💡 Improvements:</p>
                            {details.improvements.map((imp, i) => (
                              <p key={i} className="text-sm text-gray-400 pl-4">• {imp}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className="space-y-6">
                    <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                      <h4 className="text-lg font-bold mb-4 text-center">Performance Radar</h4>
                      <RadarChart
                        data={Object.values(results.feedback).map(d => d.score)}
                        labels={Object.keys(results.feedback)}
                      />
                    </div>

                    <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                      <h4 className="text-lg font-bold mb-4">Score Breakdown</h4>
                      {Object.entries(results.feedback).map(([cat, det]) => (
                        <div key={cat} className="mb-4">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm">{cat}</span>
                            <span className="text-sm font-bold">{det.score}/10</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-pink-500 to-yellow-500 h-2 rounded-full"
                              style={{ width: `${(det.score / 10) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                        <span className="text-2xl font-bold text-green-500">{results.confidence_score?.toFixed(1)}/10</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-4">
                        <div
                          className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full"
                          style={{ width: `${(results.confidence_score / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-lg">😰 Nervousness</span>
                        <span className="text-2xl font-bold text-orange-500">{results.nervousness_score?.toFixed(1)}/10</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-4">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-red-500 h-4 rounded-full"
                          style={{ width: `${(results.nervousness_score / 10) * 100}%` }}
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