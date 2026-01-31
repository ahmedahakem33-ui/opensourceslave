import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await context.bot.send_message(
        chat_id=update.effective_chat.id, 
        text="I am the Replit Agent Bot! I'm connected to your multi-platform project."
    )

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await context.bot.send_message(
        chat_id=update.effective_chat.id, 
        text="Project Status: Active\nPlatforms: iOS, macOS, Web"
    )

if __name__ == '__main__':
    # We will use an environment variable for the token
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    
    if not token:
        print("Error: TELEGRAM_BOT_TOKEN environment variable not set.")
    else:
        application = ApplicationBuilder().token(token).build()
        
        start_handler = CommandHandler('start', start)
        status_handler = CommandHandler('status', status)
        
        application.add_handler(start_handler)
        application.add_handler(status_handler)
        
        print("Bot is starting...")
        application.run_polling()
