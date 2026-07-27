let reader = null;
let controls = null;
let detected = false;

const dialog = document.querySelector("#scannerDialog");
const video = document.querySelector("#scannerVideo");
const message = document.querySelector("#scannerMessage");
const closeButton = document.querySelector("#closeScannerButton");
const cancelButton = document.querySelector("#cancelScannerButton");

export async function openBarcodeScanner(onDetected) {
  if (!window.isSecureContext) {
    throw new Error("Der Kamerazugriff benötigt HTTPS.");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Dieser Browser unterstützt keinen Kamerazugriff.");
  }
  if (!window.ZXingBrowser?.BrowserMultiFormatOneDReader) {
    throw new Error("Der Barcode-Scanner konnte nicht geladen werden.");
  }

  await stopBarcodeScanner();
  detected = false;
  message.textContent = "Kamera wird gestartet …";
  dialog.showModal();

  try {
    reader = new window.ZXingBrowser.BrowserMultiFormatOneDReader();
    controls = await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      video,
      result => {
        if (!result || detected) return;

        const value = result.getText().replace(/[^0-9Xx]/g, "");
        if (!isBookIsbn(value)) {
          message.textContent = `Code ${value} erkannt, aber er sieht nicht wie eine ISBN aus.`;
          return;
        }

        detected = true;
        message.textContent = `ISBN ${value} erkannt.`;
        navigator.vibrate?.(100);

        window.setTimeout(async () => {
          await stopBarcodeScanner();
          dialog.close();
          onDetected(value);
        }, 250);
      }
    );

    message.textContent = "Kamera aktiv – Barcode in den Rahmen halten.";
  } catch (error) {
    await stopBarcodeScanner();
    message.textContent = cameraErrorMessage(error);
  }
}

export async function stopBarcodeScanner() {
  try {
    controls?.stop();
  } catch {
    // Scanner war bereits beendet.
  }
  controls = null;
  reader = null;

  const stream = video?.srcObject;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

function isBookIsbn(value) {
  return (
    (value.length === 13 && (value.startsWith("978") || value.startsWith("979"))) ||
    value.length === 10
  );
}

function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "Kamerazugriff wurde abgelehnt. Erlaube ihn in den Browser-Einstellungen.";
  }
  if (error?.name === "NotFoundError") {
    return "Auf diesem Gerät wurde keine Kamera gefunden.";
  }
  if (error?.name === "NotReadableError") {
    return "Die Kamera wird bereits von einer anderen App verwendet.";
  }
  return `Scanner konnte nicht gestartet werden: ${error?.message || "Unbekannter Fehler"}`;
}

async function closeScanner() {
  await stopBarcodeScanner();
  if (dialog.open) dialog.close();
}

closeButton.addEventListener("click", closeScanner);
cancelButton.addEventListener("click", closeScanner);
dialog.addEventListener("cancel", event => {
  event.preventDefault();
  closeScanner();
});


export async function decodeBarcodePhoto(file) {
  if (!file) throw new Error("Es wurde kein Foto ausgewählt.");
  if (!window.ZXingBrowser?.BrowserMultiFormatOneDReader) {
    throw new Error("Der Barcode-Scanner konnte nicht geladen werden.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const photoReader = new window.ZXingBrowser.BrowserMultiFormatOneDReader();
    const result = await photoReader.decodeFromImageUrl(objectUrl);
    const value = result.getText().replace(/[^0-9Xx]/g, "");

    if (!isBookIsbn(value)) {
      throw new Error(
        `Code ${value || "unbekannt"} erkannt, aber er sieht nicht wie eine ISBN aus.`
      );
    }

    return value;
  } catch (error) {
    if (/ISBN/.test(error?.message || "")) throw error;
    throw new Error(
      "Auf dem Foto wurde kein lesbarer ISBN-Barcode gefunden. " +
      "Fotografiere den Barcode gerade, scharf und mit etwas Rand."
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
