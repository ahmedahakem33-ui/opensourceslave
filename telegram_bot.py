import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, MessageHandler, filters
from anthropic import Anthropic

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Initialize Anthropic client
# This is using Replit's AI Integrations service, which provides Anthropic-compatible API access without requiring your own Anthropic API key.
# Charges are billed to your Replit credits.
client = Anthropic(
    api_key=os.environ.get("AI_INTEGRATIONS_ANTHROPIC_API_KEY"),
    base_url=os.environ.get("AI_INTEGRATIONS_ANTHROPIC_BASE_URL")
)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "I am Clawdis, your personal AI assistant. How can I help you today?"
    )

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Project Status: Active\nAI Core: Claude 3.5 Sonnet\nPlatforms: iOS, macOS, Web, Telegram"
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text
    
    try:
        # Send thinking message
        message = await update.message.reply_text("Thinking...")
        
        # Call Anthropic API
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            messages=[
                {"role": "user", "content": user_text}
            ],
            system="You are Clawdis, a personal AI assistant. You help users manage their projects across multiple devices (iOS, macOS, Telegram). Be helpful, concise, and professional."
        )
        
        # Get response text safely
        response_text = ""
        for block in response.content:
            if hasattr(block, 'text'):
                response_text += block.text
        
        if not response_text:
            response_text = "I processed your request but didn't have a text response."

        # Update with actual response
        await context.bot.edit_message_text(
            chat_id=update.effective_chat.id,
            message_id=message.message_id,
            text=response_text
        )
    except Exception as e:
        logging.error(f"Error handling AI message: {e}")
        await update.message.reply_text("Sorry, I encountered an error while processing your request.")

if __name__ == '__main__':
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    
    if not token:
        print("Error: TELEGRAM_BOT_TOKEN environment variable not set.")
    else:
        application = ApplicationBuilder().token(token).build()
        
        application.add_handler(CommandHandler('start', start))
        application.add_handler(CommandHandler('status', status))
        application.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))
        
        print("Clawdis Bot is starting...")
        application.run_polling()
