import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, TrendingDown, ArrowLeft, Award, Target, Activity, Brain, Calendar, BarChart3, GitCompare } from 'lucide-react';

const ProgressDashboard = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, history, compare
  const [history, setHistory] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnalyses, setSelectedAnalyses] = useState([]);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
  loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const historyRes = await fetch(`http://127.0.0.1:8000/user-history/${user.userId}?limit=50`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      }

      const statsRes = await fetch(`http://127.0.0.1:8000/user-statistics/${user.userId}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.statistics);
      }
    } catch (error) {
      console.error('Error loading data:', error);
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
          setActiveTab('compare');
        }
      } catch (error) {
        console.error('Error comparing:', error);
      }
    }
  };

  // Data preparation functions
  const prepareProgressData = () => {
    return history.slice().reverse().map(item => ({
      session: `S${item.session_number}`,
      overall: item.scores.overall,
      clarity: item.scores.clarity,
      arguments: item.scores.arguments,
      grammar: item.scores.grammar,
      delivery: item.scores.delivery,
      confidence: item.confidence_score
    }));
  };

  const prepareCategoryAverages = () => {
    if (history.length === 0) return [];
    const totals = { clarity: 0, arguments: 0, grammar: 0, delivery: 0, overall: 0 };
    history.forEach(item => {
      totals.clarity += item.scores.clarity;
      totals.arguments += item.scores.arguments;
      totals.grammar += item.scores.grammar;
      totals.delivery += item.scores.delivery;
      totals.overall += item.scores.overall;
    });
    const count = history.length;
    return [
      { category: 'Clarity', score: (totals.clarity / count).toFixed(1), fullMark: 10 },
      { category: 'Arguments', score: (totals.arguments / count).toFixed(1), fullMark: 10 },
      { category: 'Grammar', score: (totals.grammar / count).toFixed(1), fullMark: 10 },
      { category: 'Delivery', score: (totals.delivery / count).toFixed(1), fullMark: 10 },
      { category: 'Overall', score: (totals.overall / count).toFixed(1), fullMark: 10 }
    ];
  };

  const calculateImprovement = () => {
    if (history.length < 2) return null;
    const recent = history.slice(0, Math.min(5, history.length));
    const old = history.slice(-Math.min(5, history.length));
    const recentAvg = recent.reduce((sum, item) => sum + item.scores.overall, 0) / recent.length;
    const oldAvg = old.reduce((sum, item) => sum + item.scores.overall, 0) / old.length;
    const improvement = ((recentAvg - oldAvg) / oldAvg) * 100;
    return {
      percentage: improvement.toFixed(1),
      isImproving: improvement > 0,
      recentAvg: recentAvg.toFixed(1),
      oldAvg: oldAvg.toFixed(1)
    };
  };

  const identifyStrengthsWeaknesses = () => {
    if (history.length === 0) return { strengths: [], weaknesses: [] };
    const categories = ['clarity', 'arguments', 'grammar', 'delivery'];
    const averages = {};
    categories.forEach(cat => {
      const sum = history.reduce((total, item) => total + item.scores[cat], 0);
      averages[cat] = sum / history.length;
    });
    const sorted = Object.entries(averages).sort((a, b) => b[1] - a[1]);
    return {
      strengths: sorted.slice(0, 2).map(([cat, score]) => ({
        category: cat.charAt(0).toUpperCase() + cat.slice(1),
        score: score.toFixed(1)
      })),
      weaknesses: sorted.slice(-2).map(([cat, score]) => ({
        category: cat.charAt(0).toUpperCase() + cat.slice(1),
        score: score.toFixed(1)
      }))
    };
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
    return <span className="flex items-center text-gray-500">0.0</span>;
  };

  const progressData = prepareProgressData();
  const categoryAverages = prepareCategoryAverages();
  const improvement = calculateImprovement();
  const strengthsWeaknesses = identifyStrengthsWeaknesses();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <button onClick={onBack} className="mb-8 flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-12 border border-gray-700 text-center">
            <Activity className="w-20 h-20 mx-auto mb-4 text-gray-600" />
            <h2 className="text-2xl font-bold mb-2">No Data Yet</h2>
            <p className="text-gray-400 mb-6">Complete at least 1 analysis to see your progress</p>
            <button onClick={onBack} className="px-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-lg font-bold hover:shadow-lg transition-all">
              Start Analyzing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-yellow-500 bg-clip-text text-transparent">
            Progress Dashboard
          </h1>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-blue-500" />
              <span className="text-3xl font-bold text-blue-500">{history.length}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-400">Total Sessions</h3>
          </div>
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-8 h-8 text-yellow-500" />
              <span className="text-3xl font-bold text-yellow-500">{statistics?.avg_overall_score || 0}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-400">Average Score</h3>
          </div>
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-green-500" />
              <span className="text-3xl font-bold text-green-500">{statistics?.best_score || 0}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-400">Best Score</h3>
          </div>
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              {improvement && improvement.isImproving ? (
                <TrendingUp className="w-8 h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500" />
              )}
              <span className={`text-3xl font-bold ${improvement && improvement.isImproving ? 'text-green-500' : 'text-red-500'}`}>
                {improvement ? `${improvement.percentage}%` : 'N/A'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-400">Improvement</h3>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-8 bg-gray-800 p-2 rounded-xl border border-gray-700">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span>History</span>
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'compare'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <GitCompare className="w-5 h-5" />
            <span>Compare</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Line Chart */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <TrendingUp className="w-6 h-6 mr-3 text-yellow-500" />
                Score Progress Over Time
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="session" stroke="#9CA3AF" />
                  <YAxis domain={[0, 10]} stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }} />
                  <Legend />
                  <Line type="monotone" dataKey="overall" stroke="#EC4899" strokeWidth={3} name="Overall" />
                  <Line type="monotone" dataKey="clarity" stroke="#3B82F6" strokeWidth={2} name="Clarity" />
                  <Line type="monotone" dataKey="arguments" stroke="#10B981" strokeWidth={2} name="Arguments" />
                  <Line type="monotone" dataKey="grammar" stroke="#F59E0B" strokeWidth={2} name="Grammar" />
                  <Line type="monotone" dataKey="delivery" stroke="#8B5CF6" strokeWidth={2} name="Delivery" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar and Radar Charts */}
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-2xl font-bold mb-6 flex items-center">
                  <Brain className="w-6 h-6 mr-3 text-yellow-500" />
                  Category Averages
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryAverages}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="category" stroke="#9CA3AF" />
                    <YAxis domain={[0, 10]} stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }} />
                    <Bar dataKey="score" fill="#EC4899" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
                <h2 className="text-2xl font-bold mb-6">Performance Radar</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={categoryAverages}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="category" stroke="#9CA3AF" />
                    <PolarRadiusAxis domain={[0, 10]} stroke="#9CA3AF" />
                    <Radar name="Score" dataKey="score" stroke="#FBBF24" fill="#FBBF24" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-green-900/20 to-gray-900 rounded-2xl p-6 border border-green-700/50">
                <h2 className="text-2xl font-bold mb-4 flex items-center text-green-500">
                  <TrendingUp className="w-6 h-6 mr-3" />
                  Your Strengths
                </h2>
                <div className="space-y-4">
                  {strengthsWeaknesses.strengths.map((item, idx) => (
                    <div key={idx} className="bg-gray-900/50 rounded-xl p-4 flex justify-between items-center">
                      <span className="font-semibold">{item.category}</span>
                      <span className="text-2xl font-bold text-green-500">{item.score}/10</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-900/20 to-gray-900 rounded-2xl p-6 border border-orange-700/50">
                <h2 className="text-2xl font-bold mb-4 flex items-center text-orange-500">
                  <Target className="w-6 h-6 mr-3" />
                  Areas to Improve
                </h2>
                <div className="space-y-4">
                  {strengthsWeaknesses.weaknesses.map((item, idx) => (
                    <div key={idx} className="bg-gray-900/50 rounded-xl p-4 flex justify-between items-center">
                      <span className="font-semibold">{item.category}</span>
                      <span className="text-2xl font-bold text-orange-500">{item.score}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <p className="text-gray-400 mb-4">
              Select 2 sessions to compare ({selectedAnalyses.length}/2 selected)
            </p>
            {selectedAnalyses.length === 2 && (
              <button
                onClick={handleCompare}
                className="mb-4 px-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-lg font-bold hover:shadow-lg transition-all"
              >
                Compare Selected Sessions →
              </button>
            )}
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
        )}

        {activeTab === 'compare' && comparison && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold mb-6">Comparison Results</h2>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-xl font-bold text-yellow-500 mb-2">Session #{comparison.older.session_number}</h3>
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
                <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-xl font-bold text-yellow-500 mb-2">Session #{comparison.newer.session_number}</h3>
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

        {activeTab === 'compare' && !comparison && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-12 border border-gray-700 text-center">
            <GitCompare className="w-20 h-20 mx-auto mb-4 text-gray-600" />
            <h2 className="text-2xl font-bold mb-2">No Comparison Selected</h2>
            <p className="text-gray-400 mb-6">Go to History tab and select 2 sessions to compare</p>
            <button
              onClick={() => setActiveTab('history')}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-lg font-bold hover:shadow-lg transition-all"
            >
              Go to History
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressDashboard;