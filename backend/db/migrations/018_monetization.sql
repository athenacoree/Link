-- ============================================================
-- ENLACE - Migración 018: Sistema de Monetización con QvaPay
-- Tablas: payment_transactions, qvapay_invoices, verification_requests,
--         username_purchases, ad_campaigns, ad_metrics
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL, -- 'verification', 'username', 'ad_campaign'
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_payment', -- 'pending_payment', 'paid', 'failed', 'refunded', 'expired'
    qvapay_trans_id TEXT,
    qvapay_url TEXT,
    remote_id TEXT UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS qvapay_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    qvapay_id TEXT UNIQUE,
    remote_id TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    status TEXT NOT NULL DEFAULT 'pending_payment', -- 'pending_payment', 'pending_review', 'approved', 'rejected', 'failed', 'expired'
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS username_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    requested_username VARCHAR(30) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    status TEXT NOT NULL DEFAULT 'pending_payment', -- 'pending_payment', 'completed', 'failed', 'expired'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    button_text TEXT NOT NULL DEFAULT 'Ver más',
    destination_url TEXT NOT NULL,
    image_url TEXT,
    target_audience JSONB DEFAULT '{}'::jsonb,
    budget NUMERIC(10, 2) NOT NULL,
    spent NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    approx_impressions INT NOT NULL DEFAULT 0,
    impressions_count INT NOT NULL DEFAULT 0,
    clicks_count INT NOT NULL DEFAULT 0,
    interactions_count INT NOT NULL DEFAULT 0,
    duration_days INT NOT NULL DEFAULT 7,
    status TEXT NOT NULL DEFAULT 'pending_payment', -- 'pending_payment', 'pending_review', 'active', 'paused', 'completed', 'rejected', 'expired'
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'impression', 'click', 'interaction'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_remote_id ON payment_transactions(remote_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_qvapay_trans_id ON payment_transactions(qvapay_trans_id);

CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);

CREATE INDEX IF NOT EXISTS idx_username_purchases_user_id ON username_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_username_purchases_requested_username ON username_purchases(LOWER(requested_username));

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user_id ON ad_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_ad_metrics_campaign_id ON ad_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_user_campaign_event ON ad_metrics(user_id, campaign_id, event_type);
