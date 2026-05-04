#include <d3d11.h>
#include <dxgi1_2.h>
#include <iostream>
#include <napi.h>
#include <vector>
#include <windows.h>

using namespace Napi;

class DXGICapture {
public:
  DXGICapture()
      : device(nullptr), context(nullptr), duplication(nullptr),
        stagingTexture(nullptr) {}
  ~DXGICapture() { Cleanup(); }

  bool Initialize() {
    if (duplication)
      return true;

    HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
                                   0, nullptr, 0, D3D11_SDK_VERSION, &device,
                                   nullptr, &context);
    if (FAILED(hr))
      return false;

    IDXGIDevice *dxgiDevice = nullptr;
    hr = device->QueryInterface(__uuidof(IDXGIDevice), (void **)&dxgiDevice);
    if (FAILED(hr))
      return false;

    IDXGIAdapter *dxgiAdapter = nullptr;
    hr = dxgiDevice->GetParent(__uuidof(IDXGIAdapter), (void **)&dxgiAdapter);
    dxgiDevice->Release();
    if (FAILED(hr))
      return false;

    IDXGIOutput *dxgiOutput = nullptr;
    hr = dxgiAdapter->EnumOutputs(0, &dxgiOutput);
    dxgiAdapter->Release();
    if (FAILED(hr))
      return false;

    IDXGIOutput1 *dxgiOutput1 = nullptr;
    hr = dxgiOutput->QueryInterface(__uuidof(IDXGIOutput1),
                                    (void **)&dxgiOutput1);
    dxgiOutput->Release();
    if (FAILED(hr))
      return false;

    hr = dxgiOutput1->DuplicateOutput(device, &duplication);
    if (SUCCEEDED(hr)) {
        dxgiOutput1->GetDesc(&outputDesc);
    }
    dxgiOutput1->Release();
    if (FAILED(hr))
      return false;

    return true;
  }

  Napi::Value Capture(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!Initialize()) {
      Napi::Error::New(env, "Failed to initialize DXGI")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    IDXGIResource *desktopResource = nullptr;
    DXGI_OUTDUPL_FRAME_INFO frameInfo;
    // Non-blocking capture
    HRESULT hr = duplication->AcquireNextFrame(0, &frameInfo, &desktopResource);

    if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
      return env.Null();
    }

    if (FAILED(hr)) {
      Cleanup(); // Reset on error
      return env.Null();
    }

    ID3D11Texture2D *acquireTexture = nullptr;
    hr = desktopResource->QueryInterface(__uuidof(ID3D11Texture2D),
                                         (void **)&acquireTexture);
    desktopResource->Release();
    if (FAILED(hr)) {
      duplication->ReleaseFrame();
      return env.Null();
    }

    D3D11_TEXTURE2D_DESC desc;
    acquireTexture->GetDesc(&desc);

    // Reuse or create staging texture
    if (stagingTexture) {
      D3D11_TEXTURE2D_DESC currentStagingDesc;
      stagingTexture->GetDesc(&currentStagingDesc);
      if (currentStagingDesc.Width != desc.Width ||
          currentStagingDesc.Height != desc.Height) {
        stagingTexture->Release();
        stagingTexture = nullptr;
      }
    }

    if (!stagingTexture) {
      D3D11_TEXTURE2D_DESC stagingDesc = desc;
      stagingDesc.Usage = D3D11_USAGE_STAGING;
      stagingDesc.BindFlags = 0;
      stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
      stagingDesc.MiscFlags = 0;

      hr = device->CreateTexture2D(&stagingDesc, nullptr, &stagingTexture);
      if (FAILED(hr)) {
        acquireTexture->Release();
        duplication->ReleaseFrame();
        return env.Null();
      }
    }

    context->CopyResource(stagingTexture, acquireTexture);
    acquireTexture->Release();
    duplication->ReleaseFrame();

    D3D11_MAPPED_SUBRESOURCE mapped;
    hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
    if (FAILED(hr)) {
      return env.Null();
    }

    Napi::Object result = Napi::Object::New(env);
    result.Set("width", desc.Width);
    result.Set("height", desc.Height);

    size_t bufferSize = desc.Width * desc.Height * 4;
    Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::New(env, bufferSize);

    uint8_t *dest = buffer.Data();
    uint8_t *src = (uint8_t *)mapped.pData;
    uint32_t targetPitch = desc.Width * 4;

    if (mapped.RowPitch == targetPitch) {
      memcpy(dest, src, bufferSize);
    } else {
      for (unsigned int y = 0; y < desc.Height; ++y) {
        memcpy(dest + (y * targetPitch), src + (y * mapped.RowPitch),
               targetPitch);
      }
    }

    context->Unmap(stagingTexture, 0);

    // ── Mouse Cursor Compositing ───────────────────────────────────────────
    // Keep the desktop frame cursor-free. The viewer draws one cursor overlay
    // from cursor metadata so movement is smoother and never duplicated.
    // ───────────────────────────────────────────────────────────────────────

    result.Set("data", buffer);
    return result;
  }

private:
  void Cleanup() {
    if (stagingTexture) {
      stagingTexture->Release();
      stagingTexture = nullptr;
    }
    if (duplication) {
      duplication->Release();
      duplication = nullptr;
    }
    if (context) {
      context->Release();
      context = nullptr;
    }
    if (device) {
      device->Release();
      device = nullptr;
    }
  }

  ID3D11Device *device;
  ID3D11DeviceContext *context;
  IDXGIOutputDuplication *duplication;
  ID3D11Texture2D *stagingTexture;
  DXGI_OUTPUT_DESC outputDesc;
};

DXGICapture g_capture;

Napi::Value CaptureFrame(const Napi::CallbackInfo& info) {
  return g_capture.Capture(info);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "captureFrame"),
              Napi::Function::New(env, CaptureFrame));
  return exports;
}

NODE_API_MODULE(capture, Init)
