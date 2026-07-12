import { FadeIn } from '@/components/ui/FadeIn';
import { Heart } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-layali-cream py-12">
      <div className="max-w-3xl mx-auto px-4">
        <FadeIn className="text-center mb-12">
          <h1 className="font-serif text-5xl font-bold text-layali-black mb-4">About Layali</h1>
          <p className="font-script text-3xl text-layali-black/70">beauty redefined</p>
        </FadeIn>

        <FadeIn delay={0.1} className="prose prose-lg max-w-none">
          <div className="bg-white rounded-3xl p-8 lg:p-12 border border-layali-pink/20 shadow-sm space-y-6 text-layali-black/70 leading-relaxed">
            <p>
              Layali is a premium beauty brand born from a passion for celebrating the unique beauty of every woman.
              Our name, meaning &ldquo;nights&rdquo; in Arabic, evokes the magic and elegance of evening rituals —
              those precious moments of self-care that transform ordinary nights into extraordinary experiences.
            </p>
            <p>
              Every product in our collection is thoughtfully curated with high-quality ingredients,
              designed to nourish your skin and hair while delivering a luxurious sensory experience.
              From our signature fragrances to our dermatologist-verified skincare lines,
              Layali represents the perfect fusion of science and beauty.
            </p>
            <p>
              We believe beauty is deeply personal. That&apos;s why we&apos;ve created an AI-powered beauty profile
              system that understands your unique skin type, hair texture, and concerns — delivering
              personalized product recommendations verified by our expert dermatologist.
            </p>
            <div className="text-center pt-6">
              <Heart className="w-6 h-6 mx-auto text-layali-pink fill-layali-pink mb-2" />
              <p className="font-script text-2xl text-layali-black/80">made with love, just for you</p>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
