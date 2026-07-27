let reader = null;
let controls = null;
let detected = false;
let activeStream = null;

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
    const deviceId = await findBestBackCamera();

    activeStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...(deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: "environment" } }),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        aspectRatio: { ideal: 16 / 9 }
      }
    });

    await improveCameraFocus(activeStream);

    reader = new window.ZXingBrowser.BrowserMultiFormatOneDReader();

    controls = await reader.decodeFromStream(
      activeStream,
      video,
      result => {
        if (!result || detected) return;

        const value = result.getText().replace(/[^0-9Xx]/g, "");

        if (!isBookIsbn(value)) {
          message.textContent =
            `Code ${value} erkannt, aber er sieht nicht wie eine ISBN aus.`;
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

    message.textContent =
      "Kamera aktiv – halte den Barcode etwa 15–25 cm entfernt und bewege das Handy langsam.";
  } catch (error) {
    await stopBarcodeScanner();
    message.textContent = cameraErrorMessage(error);
  }
}

async function findBestBackCamera() {
  // Eine kurze Freigabe sorgt dafür, dass Browser die Kameranamen anzeigen dürfen.
  let permissionStream = null;

  try {
    permissionStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } }
    });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === "videoinput");

    const rearCameras = cameras.filter(camera =>
      /back|rear|environment|rück|hinten/i.test(camera.label)
    );

    const candidates = rearCameras.length ? rearCameras : cameras;

    // Ultraweitwinkel und Telekamera sind beim nahen Barcode häufig unpraktisch.
    const normalCamera = candidates.find(camera =>
      !/ultra|wide angle|ultraweit|tele|front|facetime/i.test(camera.label)
    );

    return (normalCamera || candidates[0])?.deviceId || null;
  } finally {
    permissionStream?.getTracks().forEach(track => track.stop());
  }
}

async function improveCameraFocus(stream) {
  const track = stream.getVideoTracks()[0];
  if (!track?.getCapabilities || !track?.applyConstraints) return;

  const capabilities = track.getCapabilities();
  const advanced = {};

  if (Array.isArray(capabilities.focusMode) &&
      capabilities.focusMode.includes("continuous")) {
    advanced.focusMode = "continuous";
  }

  // Eine leichte Vergrößerung kann auf manchen Android-Geräten die Makrofokussierung
  // verbessern. Sie wird nur gesetzt, wenn die Kamera sie tatsächlich unterstützt.
  if (capabilities.zoom &&
      Number.isFinite(capabilities.zoom.min) &&
      Number.isFinite(capabilities.zoom.max) &&
      capabilities.zoom.max > capabilities.zoom.min) {
    const preferredZoom = Math.min(
      Math.max(1.25, capabilities.zoom.min),
      capabilities.zoom.max
    );
    advanced.zoom = preferredZoom;
  }

  if (Object.keys(advanced).length) {
    try {
      await track.applyConstraints({ advanced: [advanced] });
    } catch {
      // Nicht alle Browser akzeptieren sämtliche erweiterten Kamerafunktionen.
    }
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

  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }

  const stream = video?.srcObject;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
}

function isBookIsbn(value) {
  return (
    (value.length === 13 &&
      (value.startsWith("978") || value.startsWith("979"))) ||
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
  if (error?.name === "OverconstrainedError") {
    return "Die gewünschte Kameraeinstellung wird vom Gerät nicht unterstützt.";
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
