-- ============================================
-- KB.ENT Database Schema Migration
-- Run this ENTIRE script in Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================

-- ============================================
-- 1. PROFILES TABLE (extends Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  discount INTEGER,
  rating NUMERIC DEFAULT 5.0,
  reviews INTEGER DEFAULT 0,
  category TEXT,
  brand TEXT,
  gender TEXT,
  style TEXT,
  sizes TEXT[] DEFAULT '{}',
  colors TEXT[] DEFAULT '{}',
  color_stock JSONB DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  tag TEXT,
  description TEXT,
  in_stock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  subtotal NUMERIC,
  discount_amount NUMERIC DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 15,
  total NUMERIC NOT NULL,
  payment_method TEXT,
  payment_ref TEXT,
  customer_info JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT,
  color TEXT,
  quantity INTEGER NOT NULL DEFAULT 1
);

-- ============================================
-- 5. CART ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT,
  color TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. WISHLIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ============================================
-- 6b. REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  verified_purchase BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)  -- one review per user per product
);

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  status BOOLEAN;
BEGIN
  SELECT role = 'admin' INTO status FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(status, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view their own profile or admins can view all"
  ON profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- PRODUCTS policies (public read, admin write)
CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT USING (true);

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE USING (public.is_admin());

-- ORDERS policies
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own orders"
  ON orders FOR UPDATE USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- ORDER ITEMS policies
CREATE POLICY "Order items viewable by order owner or admin"
  ON order_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Anyone can insert order items"
  ON order_items FOR INSERT WITH CHECK (true);

-- CART ITEMS policies
CREATE POLICY "Users can view their own cart"
  ON cart_items FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own cart"
  ON cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart"
  ON cart_items FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own cart"
  ON cart_items FOR DELETE USING (auth.uid() = user_id);

-- WISHLIST policies
CREATE POLICY "Users can view their own wishlist"
  ON wishlist FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own wishlist"
  ON wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own wishlist"
  ON wishlist FOR DELETE USING (auth.uid() = user_id);

-- REVIEWS policies
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT USING (true);

-- Rate-limited: max 5 reviews per user per hour
CREATE POLICY "Logged-in users can submit a review"
  ON reviews FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      SELECT COUNT(*) FROM reviews
      WHERE user_id = auth.uid()
      AND created_at > NOW() - INTERVAL '1 hour'
    ) < 5
  );

CREATE POLICY "Users can update their own review"
  ON reviews FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any review"
  ON reviews FOR DELETE USING (public.is_admin());

-- ============================================
-- ADDITIONAL SECURITY CONSTRAINTS
-- ============================================

-- Sanity CHECK on order totals: prevents $0 or absurdly large orders
-- from being inserted directly into the DB even if client-side is bypassed
ALTER TABLE orders ADD CONSTRAINT check_order_total_sane
  CHECK (total > 0 AND total < 100000 AND subtotal >= 0 AND delivery_fee >= 0);

-- Tighten the orders INSERT policy: replace the open WITH CHECK (true)
-- with one that at minimum enforces non-zero totals
DROP POLICY IF EXISTS "Users can create orders" ON orders;
CREATE POLICY "Users can create orders"
  ON orders FOR INSERT WITH CHECK (
    total > 0
    AND subtotal >= 0
    AND delivery_fee >= 0
  );


-- ============================================
-- 9. HELPER FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: run after every new signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================
-- 10. SEED PRODUCTS DATA
-- ============================================
INSERT INTO products (id, name, price, original_price, discount, rating, reviews, category, brand, gender, style, sizes, colors, color_stock, images, tag, description, in_stock)
VALUES
  (1, 'Classic Graphic T-Shirt', 45, NULL, NULL, 4.5, 128, 'tshirts', 'Nike', 'Men', 'casual',
    ARRAY['Small','Medium','Large','X-Large'], ARRAY['#000000','#4B5563'],
    '{"#000000": true, "#4B5563": true}'::jsonb,
    ARRAY['/assets/images/graphic_tshirt.jpg', '/assets/images/tshirt_icon_pic.jpg'],
    'new', 'Premium oversized graphic T-shirt that fits your aesthetic. Made from 100% thick cotton.', true),

  (2, 'Baggy Casual Jeans', 65, 85, 25, 4.8, 112, 'jeans', 'Zara', 'Men', 'casual',
    ARRAY['30','32','34','36'], ARRAY['#7FA6D6','#000000'],
    '{"#7FA6D6": true, "#000000": true}'::jsonb,
    ARRAY['/assets/images/baggy_casual_jeans.jpg', '/assets/images/baggy casual black.jpg', '/assets/images/mens_casual_pants.jpg'],
    'top', 'Ultra-comfortable baggy denim jeans fit for any street style look.', true),

  (3, 'Boxy Hoodie', 120, NULL, NULL, 4.9, 320, 'hoodies', 'Adidas', 'Uni-sex', 'casual',
    ARRAY['Medium','Large','X-Large'], ARRAY['#D1D5DB','#000000'],
    '{"#D1D5DB": true, "#000000": true}'::jsonb,
    ARRAY['/assets/images/Boxy hoodie_.jpg', '/assets/images/Hoodie.jpg'],
    'sale', 'Thick, boxy hoodie. Featuring dropped shoulders and a heavy 400gsm cotton blend.', true),

  (4, 'Tailored Motionflex Suit', 250, 300, 16, 4.7, 89, 'suits', 'Hugo Boss', 'Men', 'formal',
    ARRAY['38R','40R','42R','44R'], ARRAY['#000000','#4B5563'],
    '{"#000000": true, "#4B5563": true}'::jsonb,
    ARRAY['/assets/images/black suit.jpg', '/assets/images/grey suit.jpg', '/assets/images/Mens Next Black Tailored Fit Wool Blend Motionflex Suit Trousers -  black.jpg'],
    'top', 'Sharp, elegant, and surprisingly stretchy. Complete your formal look without sacrificing comfort.', true),

  (5, 'Signature Cap', 25, NULL, NULL, 4.2, 45, 'accessories', 'Puma', 'Uni-sex', 'gym',
    ARRAY['One Size'], ARRAY['#000000','#FFFFFF'],
    '{"#000000": false, "#FFFFFF": false}'::jsonb,
    ARRAY['/assets/images/SIG CAP.jpg', '/assets/images/cap icon.jpg', '/assets/images/cap1.jpg', '/assets/images/cap3.jpg'],
    'new', 'Classic snapback cap with our signature embroidery. Works perfectly for sunny days or gym sessions.', false),

  (6, '90''s Punk Style Vest', 85, NULL, NULL, 4.9, 215, 'shirts', 'H&M', 'Men', 'party',
    ARRAY['Small','Medium','Large','X-Large'], ARRAY['#000000','#FFFFFF'],
    '{"#000000": true, "#FFFFFF": true}'::jsonb,
    ARRAY['/assets/images/punk_vest.jpg', '/assets/images/vest1.jpg', '/assets/images/vest2.jpg'],
    'new', '90''s punk-inspired vest. Distressed details and a raw edge finish make it a statement piece.', true),

  (7, 'Performance Gym Top', 45, NULL, NULL, 4.6, 310, 'tshirts', 'Under Armour', 'Men', 'gym',
    ARRAY['Small','Medium','Large'], ARRAY['#333333','#000000'],
    '{"#333333": true, "#000000": true}'::jsonb,
    ARRAY['/assets/images/gym product 1.jpg'],
    NULL, 'Moisture-wicking, breathable gym wear that helps you hit your PRs.', true),

  (8, 'Leather Jacket', 280, 350, 20, 5.0, 180, 'jackets', 'Zara', 'Men', 'party',
    ARRAY['Medium','Large','X-Large'], ARRAY['#000000'],
    '{"#000000": true}'::jsonb,
    ARRAY['/assets/images/leather jacket.jpg'],
    'top', 'Real biker leather jacket. Guaranteed to turn heads everywhere you go.', true),

  (9, 'Classic Lacoste Polo', 90, NULL, NULL, 4.7, 420, 'tshirts', 'Lacoste', 'Men', 'casual',
    ARRAY['Medium','Large','X-Large'], ARRAY['#FFFFFF','#000000'],
    '{"#FFFFFF": true, "#000000": true}'::jsonb,
    ARRAY['/assets/images/lacoste1.jpg', '/assets/images/lacoste2.jpg', '/assets/images/classy casual.jpg'],
    'featured', 'Premium knit polo shirt with excellent breathability.', true),

  (10, 'Classic T-Shirt', 35, NULL, NULL, 3.8, 18, 'tshirts', 'H&M', 'Uni-sex', 'casual',
    ARRAY['Small','Medium'], ARRAY['#FFFFFF','#0000FF'],
    '{"#FFFFFF": true, "#0000FF": true}'::jsonb,
    ARRAY['/assets/images/tshirt3.jpg', '/assets/images/Graphic T-shirt.jpg'],
    'sale', 'Classic staple t-shirt that goes with almost everything.', true),

  (11, 'FC Barcelona Jersey', 95, NULL, NULL, 4.8, 210, 'jerseys', 'Nike', 'Men', 'gym',
    ARRAY['Medium','Large','X-Large'], ARRAY['#A50044'],
    '{"#A50044": true}'::jsonb,
    ARRAY['/assets/images/epl jersey.jpg'],
    'featured', 'Official 24/25 replica jersey. Visca el Barca/EPL!', true),

  (12, 'Chelsea FC Jersey', 90, NULL, NULL, 4.6, 145, 'jerseys', 'Nike', 'Men', 'gym',
    ARRAY['Small','Medium','Large'], ARRAY['#034694'],
    '{"#034694": false}'::jsonb,
    ARRAY['/assets/images/chelsea.jpg'],
    NULL, 'Pride of London. Excellent breathable materials for maximum performance.', false),

  (13, 'Liverpool Home Kit', 90, NULL, NULL, 4.9, 320, 'jerseys', 'Nike', 'Men', 'gym',
    ARRAY['Large','X-Large'], ARRAY['#C8102E'],
    '{"#C8102E": true}'::jsonb,
    ARRAY['/assets/images/liverpool football club.jpg'],
    NULL, 'You''ll Never Walk Alone. Stand out at Anfield with the latest home kit.', true),

  (14, 'Ghana Black Stars Home', 85, NULL, NULL, 4.7, 280, 'jerseys', 'Puma', 'Men', 'casual',
    ARRAY['Medium','Large'], ARRAY['#FFFFFF'],
    '{"#FFFFFF": true}'::jsonb,
    ARRAY['/assets/images/ghana jersey1.jpg', '/assets/images/ghana jersey2.jpg'],
    'top', 'Rep the Black Stars. Premium sweat-wicking materials.', true),

  (15, 'Classic Leather Boots', 150, NULL, NULL, 4.6, 90, 'shoes', 'Clarks', 'Men', 'formal',
    ARRAY['40','41','42','43','44'], ARRAY['#654321','#000000'],
    '{"#654321": true, "#000000": true}'::jsonb,
    ARRAY['/assets/images/shoe1.jpg'],
    'top', 'Timeless leather boots perfect for completing your formal or smart-casual outfit.', true),

  (16, 'Urban Sneakers', 110, NULL, NULL, 4.5, 175, 'shoes', 'Adidas', 'Men', 'casual',
    ARRAY['41','42','43','45'], ARRAY['#FFFFFF','#CCCCCC'],
    '{"#FFFFFF": false, "#CCCCCC": false}'::jsonb,
    ARRAY['/assets/images/shoe2.jpg'],
    NULL, 'Comfort meets street style with these everyday wear urban sneakers.', false),

  (17, 'High-Top Athletics', 180, NULL, NULL, 4.9, 410, 'shoes', 'Nike', 'Men', 'party',
    ARRAY['42','43','44'], ARRAY['#000000','#FF0000'],
    '{"#000000": true, "#FF0000": true}'::jsonb,
    ARRAY['/assets/images/shoe3_pic.jpg', '/assets/images/shoe3_video.jpg'],
    'new', 'Make a statement with these premium high-top athletic shoes.', true);

-- Reset the sequence to continue after our seeded IDs
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- ============================================
-- 11. SEED DEMO ORDERS (optional)
-- ============================================
-- These will be inserted without user_id since we haven't created auth users yet.
-- Admin can see them once logged in.

INSERT INTO orders (id, user_id, status, subtotal, discount_amount, delivery_fee, total, payment_method, customer_info, created_at)
VALUES
  ('ORD-4821', NULL, 'Processing', 155, 0, 15, 155,
    'paystack', '{"name": "Kwame Asante", "email": "kwame@gmail.com", "phone": "0241112233"}'::jsonb,
    NOW() - INTERVAL '2 hours'),
  ('ORD-3317', NULL, 'Shipped', 250, 0, 15, 250,
    'paystack', '{"name": "Abena Mensah", "email": "abena@gmail.com", "phone": "0551223344"}'::jsonb,
    NOW() - INTERVAL '26 hours'),
  ('ORD-2209', NULL, 'Delivered', 390, 0, 15, 390,
    'paystack', '{"name": "Yaw Boateng", "email": "yaw@outlook.com", "phone": "0241987654"}'::jsonb,
    NOW() - INTERVAL '72 hours'),
  ('ORD-5503', NULL, 'Delivered', 90, 0, 15, 90,
    'paystack', '{"name": "Ama Owusu", "email": "ama.owusu@yahoo.com", "phone": "0275556677"}'::jsonb,
    NOW() - INTERVAL '120 hours'),
  ('ORD-1188', NULL, 'Delivered', 180, 0, 15, 180,
    'paystack', '{"name": "Kofi Adjei", "email": "kofi.adj@gmail.com", "phone": "0209876543"}'::jsonb,
    NOW() - INTERVAL '200 hours');

-- Seed order items for demo orders
INSERT INTO order_items (order_id, product_id, size, color, quantity)
VALUES
  ('ORD-4821', 1, 'L', '#000', 2),
  ('ORD-4821', 5, 'One Size', '#000', 1),
  ('ORD-3317', 4, '40R', '#000', 1),
  ('ORD-2209', 8, 'L', '#000', 1),
  ('ORD-2209', 2, '32', '#7FA6D6', 2),
  ('ORD-5503', 9, 'M', '#FFF', 1),
  ('ORD-1188', 17, '43', '#000', 1);


-- ============================================
-- DONE! Verify with:
-- SELECT COUNT(*) FROM products;    -- Should return 17
-- SELECT COUNT(*) FROM orders;      -- Should return 5
-- SELECT COUNT(*) FROM order_items;  -- Should return 7
-- ============================================
