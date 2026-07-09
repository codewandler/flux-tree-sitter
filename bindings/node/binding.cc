#include <napi.h>

typedef struct TSLanguage TSLanguage;

extern "C" TSLanguage *tree_sitter_flux();

// "tree-sitter", "language" hidden in this Napi object
namespace {

// Shared type tag node-tree-sitter uses to validate a `language` External.
static const napi_type_tag LANGUAGE_TYPE_TAG = {
    0x8AF2E5212AD58ABF, 0xD5006CAD83ABBA16};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports["name"] = Napi::String::New(env, "flux");
  auto language = Napi::External<TSLanguage>::New(env, tree_sitter_flux());
  language.TypeTag(&LANGUAGE_TYPE_TAG);
  exports["language"] = language;
  return exports;
}

}  // namespace

NODE_API_MODULE(tree_sitter_flux_binding, Init)
