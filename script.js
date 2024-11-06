document.addEventListener('DOMContentLoaded', function() {
    const cameraBtn = document.querySelector('.camera-btn');
    const clearBtn = document.querySelector('.clear-btn');
    cameraBtn.onclick = startCamera;
    clearBtn.onclick = clearAll;
});

let stream = null;

async function startCamera() {
    try {
        let camera = document.getElementById('camera');
        const capturedImage = document.getElementById('captured-image');
        capturedImage.style.display = 'none';
        camera.style.display = 'block';

        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: { exact: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        camera.srcObject = stream;

        const cameraBtn = document.querySelector('.camera-btn');
        cameraBtn.textContent = 'Capturar';
        cameraBtn.onclick = captureImage;

    } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        alert('Error al acceder a la cámara. Por favor intenta de nuevo.');
    }
}

async function captureImage() {
    const camera = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const capturedImage = document.getElementById('captured-image');

    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(camera, 0, 0);

    capturedImage.src = canvas.toDataURL('image/jpeg', 1.0);
    capturedImage.style.display = 'block';
    camera.style.display = 'none';

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    const cameraBtn = document.querySelector('.camera-btn');
    cameraBtn.textContent = 'Escanear';
    cameraBtn.onclick = startCamera;

    processImage(canvas);
}

async function processImage(canvas) {
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        const formData = new FormData();
        formData.append('image', blob);
        
        console.log("Subiendo imagen a ImgBB...");
        
        const uploadResponse = await fetch('https://api.imgbb.com/1/upload?key=52caeb3987a1d3e1407627928b18c14e', {
            method: 'POST',
            body: formData
        });
        
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
            throw new Error('Error al subir la imagen');
        }

        const imageUrl = uploadResult.data.url;
        console.log("Imagen subida:", imageUrl);
        
        const ocrUrl = `https://api.ocr.space/parse/imageurl?apikey=helloworld&url=${encodeURIComponent(imageUrl)}&OCREngine=2`;
        
        console.log("Procesando OCR...");
        const ocrResponse = await fetch(ocrUrl);
        const ocrResult = await ocrResponse.json();
        
        if (!ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
            throw new Error('OCR no pudo extraer texto de la imagen');
        }

        const text = ocrResult.ParsedResults[0].ParsedText;
        console.log("Texto OCR detectado:", text);

        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyCa362tZsWj38073XyGaMTmKC0YKc-W0I8`;
        
        const prompt = {
            "contents": [{
                "parts": [{
                    "text": `Del siguiente texto, extrae SOLO el código de barras numérico (números de 12-14 dígitos). Si hay varios códigos, devuelve solo el primero. No incluyas ningún otro texto en tu respuesta, solo los números:\n\n${text}`
                }]
            }]
        };

        console.log("Enviando a Gemini...");
        const geminiResponse = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(prompt)
        });

        const geminiResult = await geminiResponse.json();
        console.log("Respuesta de Gemini:", geminiResult);

        if (geminiResult.candidates && geminiResult.candidates[0]) {
            const barcode = geminiResult.candidates[0].content.parts[0].text.trim();
            if (/^\d{12,14}$/.test(barcode)) {
                // Buscar imagen del producto
                await searchAndDisplayProduct(barcode);
            } else {
                alert('No se encontró un código de barras válido');
            }
        } else {
            alert('No se pudo procesar el texto');
        }

    } catch (error) {
        console.error('Error al procesar la imagen:', error);
        alert('Error al procesar la imagen. Por favor, intenta de nuevo.');
    }
}

async function searchAndDisplayProduct(barcode) {
    try {
        // Realizar búsqueda de la imagen
        const searchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.google.com/search?q=${barcode}&tbm=isch`)}`;
        
        const response = await fetch(searchUrl);
        const html = await response.text();
        
        const imgRegex = /"(https?:\/\/[^"]+\.(?:jpg|jpeg|png))"/gi;
        const matches = [...html.matchAll(imgRegex)];
        
        if (matches.length > 0) {
            const validUrls = matches
                .map(match => match[1])
                .filter(url => !url.includes('gstatic') && !url.includes('google'));
            
            if (validUrls.length > 0) {
                // Mostrar imagen del producto
                const productContainer = document.querySelector('.product-image-container');
                productContainer.innerHTML = '';
                
                const productImage = document.createElement('img');
                productImage.className = 'product-image';
                productImage.src = validUrls[0];
                productImage.alt = 'Producto';
                productContainer.appendChild(productImage);
                
                // Generar código QR
                generateQR(barcode);
            }
        }
    } catch (error) {
        console.error('Error al buscar el producto:', error);
        alert('Error al buscar el producto. Por favor, intenta de nuevo.');
    }
}

function generateQR(text) {
    const qrcodeDiv = document.getElementById('qrcode');
    qrcodeDiv.innerHTML = '';
    
    new QRCode(qrcodeDiv, {
        text: text,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.H
    });

    const codeText = document.getElementById('code-text');
    codeText.textContent = text;
}

function clearAll() {
    const capturedImage = document.getElementById('captured-image');
    const camera = document.getElementById('camera');
    const productContainer = document.querySelector('.product-image-container');
    const qrcodeDiv = document.getElementById('qrcode');
    const codeText = document.getElementById('code-text');

    capturedImage.style.display = 'none';
    capturedImage.src = '';
    camera.style.display = 'none';
    productContainer.innerHTML = '';
    qrcodeDiv.innerHTML = '';
    codeText.textContent = '';

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    const cameraBtn = document.querySelector('.camera-btn');
    cameraBtn.textContent = 'Escanear';
    cameraBtn.onclick = startCamera;
}