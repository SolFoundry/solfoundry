import React from 'react';
import { X, Star, TrendingUp, Activity, Brain, Zap } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Agent {
  id: string;
  name: string;
  description: string;
  rating: number;
  price: number;
  category: string;
  avatar: string;
  skills: string[];
  completionRate: number;
  responseTime: string;
  totalJobs: number;
  experience: string;
  languages: string[];
}

interface AgentDetailModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onHire: (agentId: string) => void;
}

const AgentDetailModal: React.FC<AgentDetailModalProps> = ({
  agent,
  isOpen,
  onClose,
  onHire,
}) => {
  if (!isOpen || !agent) return null;

  const performanceData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Performance Score',
        data: [85, 88, 92, 89, 94, 96],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        min: 80,
        max: 100,
      },
    },
  };

  const handleHire = () => {
    onHire(agent.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{agent.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/3 space-y-6">
              <div className="text-center">
                <img
                  src={agent.avatar}
                  alt={agent.name}
                  className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
                />
                <div className="flex items-center justify-center gap-1 mb-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="font-semibold text-lg">{agent.rating}</span>
                  <span className="text-gray-500">({agent.totalJobs} jobs)</span>
                </div>
                <p className="text-gray-600 mb-4">{agent.description}</p>
                <div className="text-3xl font-bold text-blue-600 mb-4">
                  ${agent.price}/hr
                </div>
                <button
                  onClick={handleHire}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Hire Agent
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className="font-semibold text-green-600">
                      {agent.completionRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Response Time</span>
                    <span className="font-semibold">{agent.responseTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Experience</span>
                    <span className="font-semibold">{agent.experience}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-2/3 space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance Chart
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 h-64">
                  <Line data={performanceData} options={chartOptions} />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Core Capabilities
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">Analysis</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Advanced data analysis and pattern recognition
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-gray-900">Automation</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Process automation and workflow optimization
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Brain className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-gray-900">Learning</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Continuous learning and adaptation capabilities
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Activity className="w-5 h-5 text-orange-600" />
                      <span className="font-semibold text-gray-900">Integration</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Seamless integration with existing systems
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {agent.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Languages</h3>
                  <div className="flex flex-wrap gap-2">
                    {agent.languages.map((language) => (
                      <span
                        key={language}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                      >
                        {language}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDetailModal;