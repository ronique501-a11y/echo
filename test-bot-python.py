#!/usr/bin/env python3
"""
EchoHub Test Bot - Python Version
Easy to share and run for testing EchoHub connectivity

Usage:
  pip install requests
  python test-bot-python.py

Or set environment variables:
  export HUB_URL=http://your-hub:3847
  export BOT_NAME=MyBot
"""

import os
import json
import time
import uuid
import requests

# ============== CONFIG ==============
CONFIG = {
    'hub_url': os.environ.get('HUB_URL', 'http://localhost:3847'),
    'bot_id': f"py-bot-{uuid.uuid4().hex[:8]}",
    'bot_token': uuid.uuid4().hex,
    'bot_name': os.environ.get('BOT_NAME', 'PyBot'),
    'poll_interval': 1.0,
    'auto_respond': True
}
# ====================================

registered = False
last_message_time = 0

def log_info(msg):
    print(f"[INFO] {msg}")

def log_ok(msg):
    print(f"[OK] {msg}")

def log_error(msg):
    print(f"[ERROR] {msg}")

def log_msg(msg):
    print(f"[MSG] {msg}")

def hub_request(path, method='GET', body=None):
    url = CONFIG['hub_url'] + path
    headers = {
        'Content-Type': 'application/json',
        'X-Bot-Id': CONFIG['bot_id'],
        'X-Bot-Token': CONFIG['bot_token']
    }
    
    if method == 'GET':
        return requests.get(url, headers=headers).json()
    else:
        return requests.post(url, json=body, headers=headers).json()

def register():
    global registered
    log_info(f"Registering as '{CONFIG['bot_name']}'...")
    
    try:
        result = hub_request('/api/bot/register', 'POST', {
            'id': CONFIG['bot_id'],
            'token': CONFIG['bot_token'],
            'name': CONFIG['bot_name'],
            'source': 'test-bot-py',
            'channels': ['default', 'test']
        })
        
        if result.get('success'):
            registered = True
            log_ok(f"Registered! Hub ID: {result.get('hubId')}")
            return True
        else:
            log_error(f"Registration failed: {result.get('error')}")
            return False
    except Exception as e:
        log_error(f"Cannot reach hub: {e}")
        log_info(f"Make sure EchoHub is running at {CONFIG['hub_url']}")
        return False

def send_message(content, channel_id='default'):
    if not registered:
        return
    
    try:
        hub_request('/api/bot/message', 'POST', {
            'content': content,
            'channelId': channel_id
        })
    except Exception as e:
        log_error(f"Send failed: {e}")

def get_messages(channel_id='default'):
    global last_message_time
    
    if not registered:
        return []
    
    try:
        result = hub_request(
            f"/api/bot/messages?channelId={channel_id}&since={last_message_time}"
        )
        
        if result.get('messages'):
            last_message_time = int(time.time() * 1000)
        
        return result.get('messages', [])
    except:
        return []

def respond(content):
    lower = content.lower()
    
    if 'hello' in lower or 'hi' in lower:
        return f"Hello! I'm {CONFIG['bot_name']}. EchoHub is working! 🎉"
    if 'status' in lower or 'ping' in lower:
        return f"🟢 {CONFIG['bot_name']} is online and connected to EchoHub!"
    if 'help' in lower:
        return "Type anything and I'll respond! Say 'status' for my status."
    
    return f'You said: "{content}" - EchoHub relay working!'

def main():
    print("""
╔════════════════════════════════════════════════════════╗
║       EchoHub Test Bot (Python) - Ready to Connect!  ║
╚════════════════════════════════════════════════════════╝
    """)
    
    log_info(f"Hub URL: {CONFIG['hub_url']}")
    log_info(f"Bot ID: {CONFIG['bot_id']}")
    log_info(f"Bot Name: {CONFIG['bot_name']}")
    log_info(f"Poll Interval: {CONFIG['poll_interval']}s")
    print("")
    
    if not register():
        log_error("Failed to register. Exiting.")
        return
    
    send_message(f"🤖 {CONFIG['bot_name']} has joined the hub (Python)!")
    log_ok("Announced presence to hub")
    
    log_info("Starting message polling...")
    print("")
    
    while True:
        try:
            messages = get_messages('default')
            
            for msg in messages:
                if msg.get('sourceId') == CONFIG['bot_id']:
                    continue
                
                log_msg(f"{msg.get('sourceId')}: {msg.get('content')}")
                
                if CONFIG['auto_respond']:
                    response = respond(msg.get('content', ''))
                    log_info(f"Responding...")
                    send_message(response)
            
            time.sleep(CONFIG['poll_interval'])
        except KeyboardInterrupt:
            print("\n")
            log_info("Shutting down...")
            break
        except Exception as e:
            log_error(f"Poll error: {e}")
            time.sleep(5)

if __name__ == '__main__':
    main()
