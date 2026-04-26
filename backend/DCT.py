import cv2
import numpy as np
from scipy.fftpack import dct, idct

# -----------------------------
# DCT helper functions
# -----------------------------

def dct2(block):
    """Apply 2D DCT to an 8x8 block."""
    return dct(dct(block.T, norm="ortho").T, norm="ortho")


def idct2(block):
    """Apply inverse 2D DCT to an 8x8 block."""
    return idct(idct(block.T, norm="ortho").T, norm="ortho")


# -----------------------------
# Text <-> binary
# -----------------------------

def text_to_bits(text):
    """Convert text into binary bits."""
    bits = []
    for char in text:
        binary = format(ord(char), "08b")
        bits.extend([int(bit) for bit in binary])
    return bits


def bits_to_text(bits):
    """Convert binary bits back into text."""
    chars = []

    for i in range(0, len(bits), 8):
        byte = bits[i:i + 8]

        if len(byte) < 8:
            break

        char_code = int("".join(map(str, byte)), 2)
        chars.append(chr(char_code))

    return "".join(chars)


# -----------------------------
# Embed watermark
# -----------------------------

def embed_watermark(input_path, output_path, watermark_text):
    """
    Embed invisible watermark into an image using DCT.
    """

    img = cv2.imread(input_path)

    if img is None:
        raise ValueError("Image not found or invalid path.")

    # Convert image from BGR to YCrCb
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)

    # Use Y channel because it stores brightness
    y_channel = ycrcb[:, :, 0].astype(np.float32)

    watermark_bits = text_to_bits(watermark_text)

    height, width = y_channel.shape

    bit_index = 0
    total_bits = len(watermark_bits)

    strength = 30  # bigger = stronger watermark, but more distortion

    for row in range(0, height - 8, 8):
        for col in range(0, width - 8, 8):

            if bit_index >= total_bits:
                break

            block = y_channel[row:row + 8, col:col + 8]

            dct_block = dct2(block)

            # Pick two mid-frequency coefficients
            x1, y1 = 3, 4
            x2, y2 = 4, 3

            bit = watermark_bits[bit_index]

            c1 = dct_block[x1, y1]
            c2 = dct_block[x2, y2]

            # Embed bit using coefficient comparison
            if bit == 1:
                dct_block[x1, y1] = max(c1, c2) + strength
                dct_block[x2, y2] = min(c1, c2)
            else:
                dct_block[x2, y2] = max(c1, c2) + strength
                dct_block[x1, y1] = min(c1, c2)
            watermarked_block = idct2(dct_block)

            y_channel[row:row + 8, col:col + 8] = watermarked_block

            bit_index += 1

        if bit_index >= total_bits:
            break

    if bit_index < total_bits:
        raise ValueError("Image is too small to store this watermark.")

    # Clip values back into valid image range
    y_channel = np.clip(y_channel, 0, 255).astype(np.uint8)

    # Put modified Y channel back
    ycrcb[:, :, 0] = y_channel

    # Convert back to BGR
    result = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)

    cv2.imwrite(output_path, result)

    print("Watermark embedded successfully.")
    print("Output saved to:", output_path)


# -----------------------------
# Extract watermark
# -----------------------------

def extract_watermark(input_path, watermark_length):
    """
    Extract invisible watermark from image.
    watermark_length = number of characters expected.
    """

    img = cv2.imread(input_path)

    if img is None:
        raise ValueError("Image not found or invalid path.")

    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    y_channel = ycrcb[:, :, 0].astype(np.float32)

    height, width = y_channel.shape

    total_bits = watermark_length * 8
    extracted_bits = []

    for row in range(0, height - 8, 8):
        for col in range(0, width - 8, 8):

            if len(extracted_bits) >= total_bits:
                break

            block = y_channel[row:row + 8, col:col + 8]

            dct_block = dct2(block)

            x1, y1 = 3, 4
            x2, y2 = 4, 3

            c1 = dct_block[x1, y1]
            c2 = dct_block[x2, y2]

            bit = 1 if c1 > c2 else 0
            extracted_bits.append(bit)

        if len(extracted_bits) >= total_bits:
            break

    watermark_text = bits_to_text(extracted_bits)

    return watermark_text


# -----------------------------
# Example usage
# -----------------------------

if __name__ == "__main__":
    original_image = "original.JPG"
    watermarked_image = "notWatermarked.JPG"

    watermark = "wm8KD29Aimg4560425a9f3"

    # embed_watermark(
    #     input_path=original_image,
    #     output_path=watermarked_image,
    #     watermark_text=watermark
    # )

    extracted = extract_watermark(
        input_path=watermarked_image,
        watermark_length=len(watermark)
    )

    print("Extracted watermark:", extracted)