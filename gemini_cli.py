#!/usr/bin/env python3
"""
Robust Gemini CLI wrapper for workspace-mcp
Usage: python3 gemini_cli.py --model MODEL --prompt "PROMPT TEXT"
"""
import os
import sys
import argparse
import google.generativeai as genai

def main():
    parser = argparse.ArgumentParser(description='Gemini CLI for workspace-mcp')
    parser.add_argument('--model', default='gemini-1.5-flash', help='Gemini model to use')
    parser.add_argument('--prompt', required=True, help='Prompt text')
    parser.add_argument('--max-tokens', type=int, default=100, help='Max output tokens')
    
    args = parser.parse_args()
    
    # Check API key
    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        print("Error: GOOGLE_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Configure the API
        genai.configure(api_key=api_key)
        
        # Create model
        model = genai.GenerativeModel(args.model)
        
        # Generate content
        response = model.generate_content(
            args.prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=args.max_tokens,
                temperature=0.2,
            )
        )
        
        # Output just the text
        if response.text:
            print(response.text.strip())
        else:
            print("Error: No response generated", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
