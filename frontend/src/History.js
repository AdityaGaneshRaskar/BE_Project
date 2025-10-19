import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowLeft, BarChart3, Calendar, Award } from 'lucide-react';

const History = ({ user, onBack }) => {
  const [statistics, setStatistics] = useState(null);
  const [history, setHistory] = useState([]); // Already initialized as empty array
  const [selectedAnalyses, setSelectedAnalyses] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load statistics
      const statsRes = await fetch(`http://127.0.0.1:8000/user-statistics/${user.userId}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.statistics);
      }

      // Load history
      const historyRes = await fetch(`http://127.0.0.1:8000/user-history/${user.userId}`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history || []); // Ensure it's always an array
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnalysis = (analysisId) => {
    if (selectedAnalyses.includes(analysisId)) {
      setSelectedAnalyses(selectedAnalyses.filter(id => id !== analysisId));
    } else if (selectedAnalyses.length < 2) {
      setSelectedAnalyses([...selectedAnalyses, analysisId]);
    }
  };

  const handleCompare = async () => {
    if (selectedAnalyses.length === 2) {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/compare/${user.userId}/${selectedAnalyses[0]}/${selectedAnalyses[1]}`
        );
        if (res.ok) {
          const data = await res.json();
          setComparison(data.comparison);
        } else {
          alert('Failed to compare analyses');
        }
      } catch (error) {
        console.error('Error comparing:', error);
        alert('Error comparing analyses');
      }
    }
  };

  const ImprovementBadge = ({ value }) => {
    if (value > 0) {
      return (
        <span className="flex items-center text-green-500">
          <TrendingUp className="w-4 h-4 mr-1" />
          +{value.toFixed(1)}
        </span>
      );
    } else if (value < 0) {
      return (
        <span className="flex items-center text-red-500">
          <TrendingDown className="w-4 h-4 mr-1" />
          {value.toFixed(1)}
        </span>
      );
    }
    return (
      <span className="flex items-center text-gray-500">
        <Minus className="w-4 h-4 mr-1" />
        0.0
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">{error}</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-lg font-bold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-yellow-500 bg-clip-text text-transparent">
            Progress Tracker
          </h1>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <Award className="w-10 h-10 text-yellow-500" />
                <span className="text-3xl font-bold text-yellow-500">{statistics.total_analyses}</span>
              </div>
              <h3 className="text-lg font-semibold">Total Analyses</h3>
              <p className="text-sm text-gray-400">Sessions completed</p>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <BarChart3 className="w-10 h-10 text-green-500" />
                <span className="text-3xl font-bold text-green-500">{statistics.avg_overall_score}</span>
              </div>
              <h3 className="text-lg font-semibold">Average Score</h3>
              <p className="text-sm text-gray-400">Overall performance</p>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-10 h-10 text-pink-500" />
                <span className="text-3xl font-bold text-pink-500">{statistics.best_score}</span>
              </div>
              <h3 className="text-lg font-semibold">Best Score</h3>
              <p className="text-sm text-gray-400">Personal record</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {history.length === 0 && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-12 border border-gray-700 text-center">
            <BarChart3 className="w-20 h-20 mx-auto mb-4 text-gray-600" />
            <h2 className="text-2xl font-bold mb-2">No Analyses Yet</h2>
            <p className="text-gray-400 mb-6">
              Start analyzing your speeches to track your progress over time
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-lg font-bold hover:shadow-lg transition-all"
            >
              Analyze Your First Speech
            </button>
          </div>
        )}

        {/* Comparison Section */}
        {history.length > 0 && !comparison && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700 mb-8">
            <h2 className="text-2xl font-bold mb-4">Analysis History</h2>
            <p className="text-gray-400 mb-4">
              Select 2 analyses to compare ({selectedAnalyses.length}/2 selected)
            </p>

            {selectedAnalyses.length === 2 && (
              <button
                onClick={handleCompare}
                className="mb-4 px-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-lg font-bold hover:shadow-lg transition-all"
              >
                Compare Selected Analyses
              </button>
            )}

            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.analysis_id}
                  onClick={() => handleSelectAnalysis(item.analysis_id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    selectedAnalyses.includes(item.analysis_id)
                      ? 'bg-yellow-500/20 border-2 border-yellow-500'
                      : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <span className="px-3 py-1 bg-gray-800 rounded-full text-sm">
                          Session #{item.session_number}
                        </span>
                        <span className="text-gray-400 text-sm flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {item.analyzed_at}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{item.filename}</p>
                      <div className="grid grid-cols-5 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Clarity</p>
                          <p className="font-bold text-yellow-500">{item.scores.clarity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Arguments</p>
                          <p className="font-bold text-yellow-500">{item.scores.arguments}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Grammar</p>
                          <p className="font-bold text-yellow-500">{item.scores.grammar}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Delivery</p>
                          <p className="font-bold text-yellow-500">{item.scores.delivery}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Overall</p>
                          <p className="font-bold text-pink-500 text-lg">{item.scores.overall}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comparison View */}
        {comparison && (
          <div className="space-y-6">
            <button
              onClick={() => { setComparison(null); setSelectedAnalyses([]); }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              ← Back to History
            </button>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold mb-6">Comparison Results</h2>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Older Analysis */}
                <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-xl font-bold text-yellow-500 mb-2">
                    Session #{comparison.older.session_number}
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">{comparison.older.analyzed_at}</p>
                  <div className="space-y-3">
                    {Object.entries(comparison.older.feedback).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key}</span>
                        <span className="font-bold">{val.score}/10</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Newer Analysis */}
                <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-xl font-bold text-yellow-500 mb-2">
                    Session #{comparison.newer.session_number}
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">{comparison.newer.analyzed_at}</p>
                  <div className="space-y-3">
                    {Object.entries(comparison.newer.feedback).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key}</span>
                        <span className="font-bold">{val.score}/10</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Improvement Summary */}
              <div className="bg-gradient-to-r from-pink-500/20 to-yellow-500/20 rounded-xl p-6 border border-yellow-500/50">
                <h3 className="text-2xl font-bold mb-4">📈 Improvement Summary</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {Object.entries(comparison.improvement).map(([key, value]) => (
                    <div key={key} className="bg-gray-900/50 rounded-lg p-4">
                      <p className="text-sm text-gray-400 capitalize mb-2">{key}</p>
                      <ImprovementBadge value={value} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;