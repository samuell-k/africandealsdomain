-- Insert sample portfolio items
INSERT INTO portfolio_items (title, description, category, image_url, featured) VALUES
('Wedding Photography Session', 'Beautiful outdoor wedding ceremony captured in golden hour lighting', 'photography', '/placeholder.svg?height=400&width=600', true),
('Corporate Brand Video', 'Dynamic promotional video showcasing company culture and values', 'videography', '/placeholder.svg?height=400&width=600', true),
('Logo Design Project', 'Modern minimalist logo design for tech startup', 'graphic-design', '/placeholder.svg?height=400&width=600', false),
('Product Photography', 'High-end product shots for e-commerce catalog', 'photography', '/placeholder.svg?height=400&width=600', false),
('Event Videography', 'Conference highlights and keynote speaker coverage', 'videography', '/placeholder.svg?height=400&width=600', false),
('Brand Identity Package', 'Complete visual identity system including logo, colors, and typography', 'graphic-design', '/placeholder.svg?height=400&width=600', true);

-- Insert sample services
INSERT INTO services (title, description, price_range, icon, featured) VALUES
('Wedding Photography', 'Complete wedding day coverage with edited gallery delivery within 2 weeks', '$1,500-$3,000', 'Camera', true),
('Corporate Videography', 'Professional video production for marketing, training, and promotional content', '$2,000-$5,000', 'Video', true),
('Brand Design', 'Logo design, brand guidelines, and complete visual identity development', '$800-$2,500', 'Palette', false),
('Product Photography', 'High-quality product shots for e-commerce and marketing materials', '$300-$800', 'Package', false),
('Event Coverage', 'Photography and videography services for corporate events and celebrations', '$500-$1,500', 'Calendar', false);

-- Insert sample testimonials
INSERT INTO testimonials (client_name, client_company, testimonial, rating, featured) VALUES
('Sarah Johnson', 'Tech Innovations Inc.', 'Absolutely incredible work! The team captured our company culture perfectly in the brand video. Professional, creative, and delivered exactly what we envisioned.', 5, true),
('Michael Chen', 'Chen Wedding Planning', 'Our wedding photos are beyond beautiful. Every moment was captured with such artistry and attention to detail. We could not be happier!', 5, true),
('Emily Rodriguez', 'StartUp Solutions', 'The logo design process was collaborative and the final result exceeded our expectations. Great communication throughout the project.', 5, false),
('David Thompson', 'Thompson Events', 'Professional event coverage that really showcased the energy of our conference. Highly recommend for any corporate event needs.', 4, false);
