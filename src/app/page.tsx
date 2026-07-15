'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Heart, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/FadeIn';

const features = [
  {
    icon: Sparkles,
    title: 'Personalized For You',
    description: 'AI-powered beauty recommendations tailored to your unique skin and hair profile.',
  },
  {
    icon: Shield,
    title: 'Dermatologist Verified',
    description: 'Every personalized combo is certified and verified by our expert dermatologist.',
  },
  {
    icon: Heart,
    title: 'Made With Love',
    description: 'Premium ingredients crafted with care for the modern woman.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center gradient-pink overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 border border-layali-black rounded-full" />
          <div className="absolute bottom-20 right-10 w-48 h-48 border border-layali-black rounded-full" />
          <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-layali-black rounded-full animate-float" />
          <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-layali-black rounded-full animate-float" style={{ animationDelay: '1s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <p className="text-sm tracking-[0.3em] text-layali-black/60 mb-4 uppercase">
                Welcome to
              </p>
              <h1 className="font-serif text-6xl lg:text-8xl font-bold tracking-widest text-layali-black mb-4">
                LAYALI
              </h1>
              <p className="font-script text-4xl lg:text-5xl text-layali-black/80 mb-2">
                beauty redefined
              </p>
              <p className="text-layali-black/70 text-lg max-w-md mb-8 leading-relaxed">
                Discover premium beauty products curated just for you.
                From skincare to fragrances, experience luxury that celebrates your unique beauty.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/shop">
                  <Button size="lg">
                    Shop Now <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="aspect-square max-w-lg mx-auto relative">
                <div className="absolute inset-0 bg-layali-black rounded-3xl transform rotate-3" />
                <div className="absolute inset-0 bg-layali-pink rounded-3xl transform -rotate-3 flex items-center justify-center">
                  <div className="text-center p-8">
                    <span className="font-serif text-5xl font-bold tracking-widest text-layali-black">LAYALI</span>
                    <p className="font-script text-3xl text-layali-black/70 mt-4">thank you</p>
                    <p className="text-xs tracking-[0.2em] text-layali-black/50 mt-2">
                      FOR CHOOSING US
                    </p>
                    <div className="flex justify-center gap-2 mt-6">
                      <Heart className="w-4 h-4 text-layali-black fill-layali-black" />
                      <Heart className="w-3 h-3 text-layali-black fill-layali-black" />
                      <Heart className="w-4 h-4 text-layali-black fill-layali-black" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <h2 className="font-serif text-4xl font-bold text-layali-black mb-4">Why Layali?</h2>
            <p className="text-layali-black/60 max-w-2xl mx-auto">
              We believe beauty is personal. That&apos;s why every experience with Layali is tailored to you.
            </p>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <div className="text-center p-8 rounded-2xl bg-layali-cream border border-layali-pink/20 card-hover">
                  <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-layali-pink-light flex items-center justify-center">
                    <feature.icon className="w-7 h-7 text-layali-black" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-layali-black mb-3">{feature.title}</h3>
                  <p className="text-layali-black/60 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-dark text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FadeIn>
            <p className="font-script text-4xl text-layali-pink-light mb-4">your beauty journey</p>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold mb-6">
              Start with a Personalized Survey
            </h2>
            <p className="text-white/70 mb-8 max-w-2xl mx-auto leading-relaxed">
              Take our fun beauty quiz and receive a custom combo curated by AI,
              verified by our dermatologist — just for you.
            </p>
            <Link href="/auth/signup">
              <Button variant="gold" size="lg">
                Take the Survey <Sparkles className="w-5 h-5" />
              </Button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* Categories Preview */}
      <section className="py-20 bg-layali-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-12">
            <h2 className="font-serif text-4xl font-bold text-layali-black mb-4">Shop by Category</h2>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Skincare', 'Haircare', 'Fragrance', 'Body Care'].map((cat, i) => (
              <FadeIn key={cat} delay={i * 0.1}>
                <Link href={`/shop?category=${cat.toLowerCase().replace(' ', '')}`}>
                  <div className="aspect-square rounded-2xl bg-layali-pink-light/50 border border-layali-pink/30 flex items-center justify-center card-hover">
                    <span className="font-serif text-lg font-bold text-layali-black">{cat}</span>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
