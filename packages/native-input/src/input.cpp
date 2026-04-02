#include <napi.h>
#include <windows.h>
#include <string>

Napi::Value InjectMouseMove(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    double x = info[0].As<Napi::Number>().DoubleValue();
    double y = info[1].As<Napi::Number>().DoubleValue();

    INPUT input = {0};
    input.type = INPUT_MOUSE;
    // MOUSEEVENTF_ABSOLUTE uses coordinates from 0 to 65535
    // MOUSEEVENTF_VIRTUALDESK ensures it works across multiple monitors
    input.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    input.mi.dx = (LONG)(x * 65535.0);
    input.mi.dy = (LONG)(y * 65535.0);

    SendInput(1, &input, sizeof(INPUT));
    return env.Null();
}

Napi::Value InjectMouseAction(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string button = info[0].As<Napi::String>().Utf8Value();
    std::string action = info[1].As<Napi::String>().Utf8Value();

    INPUT input = {0};
    input.type = INPUT_MOUSE;

    if (button == "left") {
        input.mi.dwFlags = (action == "down") ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
    } else if (button == "right") {
        input.mi.dwFlags = (action == "down") ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
    } else if (button == "middle") {
        input.mi.dwFlags = (action == "down") ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
    }

    SendInput(1, &input, sizeof(INPUT));
    return env.Null();
}

Napi::Value InjectMouseScroll(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    int deltaX = info[0].As<Napi::Number>().Int32Value();
    int deltaY = info[1].As<Napi::Number>().Int32Value();

    // Vertical scroll
    if (deltaY != 0) {
        INPUT input = {0};
        input.type = INPUT_MOUSE;
        input.mi.dwFlags = MOUSEEVENTF_WHEEL;
        // Windows WHEEL_DELTA is 120 per notch; browser deltaY is in pixels (3 lines ~= 100px ~= 1 notch)
        input.mi.mouseData = (DWORD)(-(deltaY * 120 / 100));
        SendInput(1, &input, sizeof(INPUT));
    }

    // Horizontal scroll
    if (deltaX != 0) {
        INPUT input = {0};
        input.type = INPUT_MOUSE;
        input.mi.dwFlags = MOUSEEVENTF_HWHEEL;
        input.mi.mouseData = (DWORD)(deltaX * 120 / 100);
        SendInput(1, &input, sizeof(INPUT));
    }

    return env.Null();
}

Napi::Value InjectKeyAction(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsString()) {
        Napi::TypeError::New(env, "Number and string expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    int vk = info[0].As<Napi::Number>().Int32Value();
    std::string action = info[1].As<Napi::String>().Utf8Value();

    INPUT input = {0};
    input.type = INPUT_KEYBOARD;
    input.ki.wVk = (WORD)vk;
    input.ki.dwFlags = (action == "up") ? KEYEVENTF_KEYUP : 0;

    SendInput(1, &input, sizeof(INPUT));
    return env.Null();
}

Napi::Value InjectText(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::u16string text = info[0].As<Napi::String>().Utf16Value();
    for (char16_t c : text) {
        INPUT input = {0};
        input.type = INPUT_KEYBOARD;
        input.ki.wVk = 0;
        input.ki.wScan = (WORD)c;
        input.ki.dwFlags = KEYEVENTF_UNICODE;
        SendInput(1, &input, sizeof(INPUT));

        input.ki.dwFlags |= KEYEVENTF_KEYUP;
        SendInput(1, &input, sizeof(INPUT));
    }

    return env.Null();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "injectMouseMove"), Napi::Function::New(env, InjectMouseMove));
    exports.Set(Napi::String::New(env, "injectMouseAction"), Napi::Function::New(env, InjectMouseAction));
    exports.Set(Napi::String::New(env, "injectMouseScroll"), Napi::Function::New(env, InjectMouseScroll));
    exports.Set(Napi::String::New(env, "injectKeyAction"), Napi::Function::New(env, InjectKeyAction));
    exports.Set(Napi::String::New(env, "injectText"), Napi::Function::New(env, InjectText));
    return exports;
}

NODE_API_MODULE(input_injection, Init)
