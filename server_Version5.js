require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/paypal-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body.toString('utf8');
    const event = JSON.parse(rawBody);

    if (event.event_type === 'PAYMENT.SALE.COMPLETED' || event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const amount = Number(event.resource?.amount?.total || 0);
      let plan = 'free';

      if (amount >= 20) plan = 'premium';
      else if (amount >= 10) plan = 'pro';

      const email = event.resource?.payer?.email_address || event.resource?.buyer_email || null;

      if (!email) {
        return res.status(200).send('OK');
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !profile) {
        return res.status(200).send('OK');
      }

      await supabase
        .from('profiles')
        .update({
          plan,
          subscription_status: 'active'
        })
        .eq('id', profile.id);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});