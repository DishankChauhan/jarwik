#!/bin/bash

echo "🔧 Configuring Twilio for Central Number Approach"
echo "================================================"

# Check environment variables
if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ] || [ -z "$TWILIO_PHONE_NUMBER" ]; then
    echo "❌ Missing Twilio environment variables. Please check your .env.local file."
    exit 1
fi

echo "✅ Twilio Account SID: ${TWILIO_ACCOUNT_SID:0:10}..."
echo "✅ Twilio Phone Number: $TWILIO_PHONE_NUMBER"

# For local development, we need ngrok
echo ""
echo "🌐 Setting up local development webhook..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "Installing ngrok..."
    npm install -g ngrok
fi

# Start ngrok
echo "Starting ngrok tunnel..."
ngrok http 3000 > /dev/null 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for tunnel in data['tunnels']:
        if tunnel['proto'] == 'https':
            print(tunnel['public_url'])
            break
except:
    pass
")

if [ -n "$NGROK_URL" ]; then
    WEBHOOK_URL="$NGROK_URL/api/sms-webhook"
    echo "✅ Webhook URL: $WEBHOOK_URL"
    
    echo ""
    echo "📋 TWILIO CONFIGURATION REQUIRED:"
    echo "================================="
    echo "1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
    echo "2. Click on your phone number: $TWILIO_PHONE_NUMBER"
    echo "3. In the 'Messaging' section:"
    echo "   - Set 'A message comes in' to: Webhook"
    echo "   - Set URL to: $WEBHOOK_URL"
    echo "   - Set HTTP method to: POST"
    echo "4. Save Configuration"
    echo ""
    echo "🎯 CENTRAL NUMBER APPROACH ACTIVE!"
    echo "=================================="
    echo "• Jarwik Central Number: $TWILIO_PHONE_NUMBER"
    echo "• Users text this number from their personal phones"
    echo "• No individual Twilio setup required"
    echo ""
    echo "🧪 TEST INSTRUCTIONS:"
    echo "===================="
    echo "1. Go to: http://localhost:3000/settings"
    echo "2. Add your personal phone number (e.g., +91 9058566665)"
    echo "3. From your phone, text: $TWILIO_PHONE_NUMBER"
    echo "4. Send message: 'Schedule meeting tomorrow at 2pm'"
    echo "5. Check for response and calendar event!"
    echo ""
    echo "Press Ctrl+C to stop ngrok"
    
    # Keep running
    trap "kill $NGROK_PID 2>/dev/null; exit" INT
    while true; do
        sleep 1
    done
else
    echo "❌ Failed to start ngrok tunnel"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi
