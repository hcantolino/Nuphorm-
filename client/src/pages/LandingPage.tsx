import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarChart3, FileText, Lock, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to regulatory document page
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/regulatory");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MedReg Platform</h1>
          </div>
          <Button
            onClick={() => setShowAuthModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Advanced Biostatistics for Regulatory Documentation
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Generate comprehensive biostatistical analyses and regulatory reports with AI-powered insights. Start with your free trial—1 analysis included.
          </p>
          <Button
            onClick={() => setShowAuthModal(true)}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
          >
            Get Started Free
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="p-6 hover:shadow-lg transition">
            <BarChart3 className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Analytics</h3>
            <p className="text-gray-600">Comprehensive statistical analysis with multiple chart types and visualizations</p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <FileText className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Report Generation</h3>
            <p className="text-gray-600">Generate professional regulatory reports with AI-powered interpretations</p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <Zap className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Assistant</h3>
            <p className="text-gray-600">Get instant insights and recommendations from our AI-powered analysis engine</p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <Lock className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Compliant</h3>
            <p className="text-gray-600">Enterprise-grade security with full compliance for regulatory requirements</p>
          </Card>
        </div>

        {/* Pricing Preview */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-16">
          <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Simple, Transparent Pricing</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 border-2 border-gray-200">
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Free Trial</h4>
              <p className="text-gray-600 mb-4">Perfect for getting started</p>
              <div className="text-3xl font-bold text-gray-900 mb-6">Free</div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
                  1 biostatistical analysis
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
                  Basic report generation
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
                  Chart visualization
                </li>
              </ul>
              <Button
                onClick={() => setShowAuthModal(true)}
                variant="outline"
                className="w-full"
              >
                Start Free
              </Button>
            </Card>

            <Card className="p-8 border-2 border-blue-600 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-xl font-semibold text-gray-900">Professional</h4>
                <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Popular</span>
              </div>
              <p className="text-gray-600 mb-4">For serious analysis</p>
              <div className="text-3xl font-bold text-gray-900 mb-2">$30<span className="text-lg text-gray-600">/month</span></div>
              <p className="text-sm text-gray-600 mb-6">or $300/year (save 17%)</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
                  Unlimited analyses
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
                  Advanced AI insights
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
                  Priority support
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
                  Report templates
                </li>
              </ul>
              <Button
                onClick={() => setShowAuthModal(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Start Professional
              </Button>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-12 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">Ready to get started?</h3>
          <p className="text-lg mb-8 opacity-90">Join hundreds of researchers using MedReg for regulatory documentation</p>
          <Button
            onClick={() => setShowAuthModal(true)}
            size="lg"
            className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-6 text-lg font-semibold"
          >
            Start Your Free Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition">Features</a></li>
                <li><a href="#" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#" className="hover:text-white transition">Compliance</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition">API Docs</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center">
            <p>&copy; 2026 MedReg Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
