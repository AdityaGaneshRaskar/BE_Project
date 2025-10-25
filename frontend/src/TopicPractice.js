import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Upload, CheckCircle, Copy, Volume2, MessageSquare, BarChart3 } from 'lucide-react';

const TopicPractice = ({ user, onBack }) => {
  const [step, setStep] = useState('enter-topic'); // enter-topic, generating, upload, results
  const [topic, setTopic] = useState('');
  const [geminiSpeech, setGeminiSpeech] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [comparison, setComparison] = useState(null);

  const handleGenerateSpeech = async () => {
    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/generate-gemini-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic: topic }),
      });

      const data = await response.json();
      if (data.success) {
        setGeminiSpeech(data.speech);
        setStep('upload');
      } else {
        alert('Failed to generate speech');
      }
    } catch (error) {
      alert('Error generating speech: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
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
    if (!file) {
      alert('Please upload a file');
      return;
    }

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setFeedback(data.feedback);

        // Save to database if user is logged in
        if (user && !user.isGuest && user.userId) {
          await fetch('http://127.0.0.1:8000/save-analysis', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: user.userId,
              analysis_data: {
                ...data,
                filename: file.filename,
                topic: topic
              }
            }),
          });
        }

        // Compare speeches
        const compareResponse = await fetch('http://127.0.0.1:8000/compare-speeches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_transcript: data.transcription,
            gemini_speech: geminiSpeech
          }),
        });

        if (compareResponse.ok) {
          const compareData = await compareResponse.json();
          setComparison(compareData.analysis);
        }

        setStep('results');
      } else {
        alert('Analysis failed');
      }
    } catch (error) {
      alert('Error: ' + error.message);
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

  // Step 1: Enter Topic
  if (step === 'enter-topic') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <button onClick={onBack} className="mb-8 flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl p-8 border-2 border-purple-500">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              Topic-Based Practice
            </h1>
            <p className="text-gray-300 mb-8">
              Enter any topic you'd like to practice speaking about. We'll generate a professional reference speech that you can compare with yours.
            </p>

            <div className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium mb-2">Enter Your Topic</span>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Example: 'The impact of artificial intelligence on education'"
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-4 focus:outline-none focus:border-purple-500 transition-colors"
                  rows="4"
                />
              </label>

              <button
                onClick={handleGenerateSpeech}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Generating Reference Speech...
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-2">
                    <Sparkles className="w-5 h-5" />
                    <span>Generate AI Reference Speech</span>
                  </span>
                )}
              </button>
            </div>

            <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-400">
                💡 <strong>Tip:</strong> Be specific with your topic. Instead of "Technology", try "How AI is changing job markets in developing countries".
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Upload Your Speech
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setStep('enter-topic')} className="mb-8 flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Reference Speech */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Sparkles className="w-6 h-6 mr-2 text-yellow-500" />
                AI Reference Speech
              </h2>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 mb-4 max-h-96 overflow-y-auto">
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{geminiSpeech}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => copyToClipboard(geminiSpeech)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => speakText(geminiSpeech)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Listen</span>
                </button>
              </div>
            </div>

            {/* Upload Your Speech */}
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border-2 border-purple-500">
              <h2 className="text-2xl font-bold mb-4">Your Speech</h2>
              <p className="text-gray-300 mb-4">Now record your own speech on the same topic.</p>

              <label className="block mb-6">
                <div className="border-2 border-dashed border-purple-500 rounded-xl p-8 hover:border-pink-500 transition-all cursor-pointer bg-gray-900/50">
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="text-center">
                    {!file ? (
                      <>
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                        <p className="text-gray-400">Click to upload your speech</p>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                        <p className="text-green-500 font-medium">{file.name}</p>
                      </>
                    )}
                  </div>
                </div>
              </label>

              {preview && (
                <div className="mb-4 rounded-xl overflow-hidden bg-black">
                  {preview.type.startsWith('video') ? (
                    <video src={preview.url} controls className="w-full max-h-48" />
                  ) : (
                    <audio src={preview.url} controls className="w-full" />
                  )}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file || isAnalyzing}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Analyzing...
                  </span>
                ) : (
                  'Analyze & Compare'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Results & Comparison
  if (step === 'results') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => setStep('enter-topic')} className="mb-8 flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>New Topic</span>
          </button>

          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Speech Analysis & Comparison
          </h1>

          {/* Feedback Section */}
          {feedback && !feedback.Error && (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 mb-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <MessageSquare className="w-6 h-6 mr-3 text-yellow-500" />
                AI Feedback on Your Speech
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {Object.entries(feedback).map(([category, details]) => (
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
                    {details.improvements && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-yellow-500">Improvements:</p>
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

          {/* Comparison Section */}
          {comparison && (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 mb-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <BarChart3 className="w-6 h-6 mr-3 text-blue-500" />
                Your Speech vs AI Reference
              </h2>

              {/* Metrics Comparison */}
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
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-purple-500">{comparison.vocabulary_level_user}</span>
                    <span className="text-yellow-500">{comparison.vocabulary_level_gemini}</span>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                  <p className="text-sm text-gray-400 mb-2">Structure Quality</p>
                  <p className="text-xs text-gray-300 mt-2">{comparison.structure_analysis}</p>
                </div>
              </div>

              {/* Key Points Comparison */}
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

              {/* Strengths & Areas to Improve */}
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

              {/* Recommendations */}
              <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700">
                <h3 className="font-bold text-blue-400 mb-3">Recommendations for Next Time</h3>
                <ul className="space-y-2">
                  {comparison.recommendations?.map((rec, i) => (
                    <li key={i} className="text-sm text-gray-300">• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Transcripts Section */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Your Transcript */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4">Your Speech Transcript</h3>
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
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4">AI Reference Speech Transcript</h3>
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
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default TopicPractice;