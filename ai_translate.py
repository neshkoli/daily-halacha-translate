from google import genai
from google.genai import types
import wave
import os
import io
import ffmpeg

def convert_to_ogg_opus(input_data, output_filename):
    """
    Convert raw audio data to OGG with Opus codec using ffmpeg.
    """
    try:
        # Save raw data as temporary WAV first
        temp_wav = "temp_audio.wav"
        with wave.open(temp_wav, "wb") as wf:
            wf.setnchannels(1)  # Mono
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(24000)  # 24kHz
            wf.writeframes(input_data)
        
        # Convert to OGG with Opus codec
        (
            ffmpeg
            .input(temp_wav)
            .output(output_filename, acodec='libopus', ac=1)
            .overwrite_output()
            .run(quiet=True)
        )
        
        # Clean up temp file
        os.remove(temp_wav)
        return True
    except Exception as e:
        print(f"Error converting to OGG: {e}")
        return False
    
def convert_to_mp3(input_data, output_filename):
    """
    Convert raw audio data to MP3 using ffmpeg.
    """
    try:
        # Save raw data as temporary WAV first
        temp_wav = "temp_audio.wav"
        with wave.open(temp_wav, "wb") as wf:
            wf.setnchannels(1)  # Mono
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(24000)  # 24kHz
            wf.writeframes(input_data)
        
        # Convert to MP3
        (
            ffmpeg
            .input(temp_wav)
            .output(output_filename, acodec='mp3', ac=1)
            .overwrite_output()
            .run(quiet=True)
        )
        
        # Clean up temp file
        os.remove(temp_wav)
        return True
    except Exception as e:
        print(f"Error converting to MP3: {e}")
        return False

def transcribe_and_translate(audio_file_path_hebrew):
    """
    Transcribes a Hebrew audio file and translates it to English.
    Returns the English translation text.
    """
    try:
        if not audio_file_path_hebrew or not os.path.exists(audio_file_path_hebrew):
            print("Error: No audio file provided or file does not exist.")
            return None

        print("Proceeding with audio transcription and translation...")
        
        # Initialize Gemini client
        client = genai.Client(api_key="AIzaSyD5qM7mZGfCAilFULh2SRVsWaOQkWrQYu0")
        
        # Load the Hebrew audio file
        with open(audio_file_path_hebrew, "rb") as audio_file:
            audio_bytes = audio_file.read()

        # Create proper content structure using types
        audio_part = types.Part(
            inline_data=types.Blob(
                mime_type="audio/opus",
                data=audio_bytes
            )
        )
        
        text_part = types.Part(
            text="Transcribe this Hebrew audio and translate the transcription to English. Output only the English translation."
        )
        
        content = types.Content(parts=[audio_part, text_part])

        # Use a multimodal Gemini model for transcription and translation
        print("Sending audio for transcription and translation...")
        response = client.models.generate_content(
            model="gemini-1.5-flash",  # Or "gemini-1.5-pro" for higher quality
            contents=[content]
        )

        english_text_translation = response.candidates[0].content.parts[0].text
        print(f"Translated English Text: {english_text_translation}")
        
        return english_text_translation

    except Exception as e:
        print(f"An error occurred during transcription/translation: {e}")
        return None

def text_to_speech(english_text, output_filename, voice_name="Enceladus"):
    """
    Converts English text to speech using Gemini TTS and saves as both MP3 and OGG with Opus codec.
    
    Args:
        english_text (str): Text to convert to speech
        output_filename (str): Base filename for output (without extension)
        voice_name (str): Voice to use for TTS (e.g., 'Enceladus', 'Charon', 'sadaltager', 'rasalgethi')
    """
    try:
        if not english_text:
            print("Error: No English text provided for TTS.")
            return False

        # Initialize Gemini client
        client = genai.Client(api_key="AIzaSyD5qM7mZGfCAilFULh2SRVsWaOQkWrQYu0")

        # Read prompt instructions from prompt.txt
        prompt_instructions = read_txt_file("prompt.txt")
        if prompt_instructions:
            # Combine prompt instructions with the text to be spoken
            content = f"{prompt_instructions}\n\n{english_text}"
            print(f"Using prompt instructions from prompt.txt")
        else:
            # Fallback to just the text if prompt.txt is not found
            content = english_text
            print("Warning: prompt.txt not found, using text without additional instructions")

        print(f"Generating English audio from text using voice: {voice_name}...")
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-tts",
            contents=content,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(          
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name,  # Use the parameter instead of hardcoded value
                        )
                   )
                ),
            )
        )

        # Extract audio data
        audio_data = response.candidates[0].content.parts[0].inline_data.data
        
        # Generate both MP3 and OGG filenames
        mp3_filename = f"{output_filename}.mp3"
        # ogg_filename = f"{output_filename}.ogg"
        
        # Convert and save as MP3
        print("Converting to MP3... "+mp3_filename)
        mp3_success = convert_to_mp3(audio_data, mp3_filename)
        if mp3_success:
            print(f"English audio saved successfully:")
            print(f"  MP3: {mp3_filename}")
            return True
        else:
            print(f"Failed to save MP3 audio: {mp3_filename}")
            return False

    except Exception as e:
        print(f"An error occurred during TTS: {e}")
        return False

def read_txt_file(file_path):
    """
    Reads the content of a text file and returns it as a string.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return None
    except Exception as e:
        print(f"An error occurred while reading the file: {e}")
        return None

def transcribe_translate_and_tts(audio_file_path_hebrew, voice_name="Enceladus"):
    """
    Main function that orchestrates the transcription, translation, and TTS process.
    
    Args:
        audio_file_path_hebrew (str): Path to Hebrew audio file
        voice_name (str): Voice to use for TTS
    """
    # Step 1: Transcribe and translate
    english_text = transcribe_and_translate(audio_file_path_hebrew)
    # english_text = read_txt_file("english_text_translation.txt")  # For testing, replace with actual transcription function

    if not english_text:
        print("Error: Could not get English text for TTS.")
        return
    
    # Step 2: Convert to speech (saves both MP3 and OGG)
    output_filename =  audio_file_to_process.rsplit('.', 1)[0] # Remove file extension
    output_filename = output_filename + "-" + voice_name
    success = text_to_speech(english_text, output_filename, voice_name)
    
    if success:
        print("Process completed successfully!")
    else:
        print("TTS process failed.")

# Replace with the path to your actual Hebrew audio file
audio_file_to_process = "./halacha-12-06-2025.opus" # Or .wav

# You can now specify different voices:
transcribe_translate_and_tts(audio_file_to_process, voice_name="achird")  # Or "sadaltager", "rasalgethi", etc.