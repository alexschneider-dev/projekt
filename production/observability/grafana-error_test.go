package observability

import (
 "bytes"
 "html/template"
 "os"
 "strings"
 "testing"
)

// Felder aus Grafana 13.2.4 ReqContext.Handle.
// https://github.com/grafana/grafana/blob/v13.2.4/pkg/services/contexthandler/model/model.go
func TestErrorTemplateWithoutAssets(t *testing.T) {
 source, err := os.ReadFile("grafana/error.html")
 if err != nil { t.Fatal(err) }
 tmpl, err := template.New("error").Delims("[[", "]]").Parse(string(source))
 if err != nil { t.Fatal(err) }
 for _, subURL := range []string{"", "/grafana"} {
  data := struct { Title, AppTitle, AppSubUrl, ThemeType string; ErrorMsg error }{
   "Failed <script>alert(1)</script>", "Grafana", subURL, "dark", nil,
  }
  var output bytes.Buffer
  if err := tmpl.Execute(&output, data); err != nil { t.Fatal(err) }
  html := output.String()
  if strings.Contains(html, "<script>") { t.Fatal("Nicht escapeter Fehlertitel") }
  if !strings.Contains(html, `href="`+subURL+`/"`) { t.Fatal("Falscher Unterpfad-Link") }
  if !strings.Contains(html, "Failed &lt;script&gt;") { t.Fatal("Fehlertitel fehlt") }
 }
}

func TestUpstreamAssetAccessReproducesReportedFailure(t *testing.T) {
 tmpl := template.Must(template.New("upstream").Delims("[[", "]]").Parse("[[range .Assets.CSSFiles]][[.FilePath]][[end]]"))
 data := struct { Title, AppTitle, AppSubUrl, ThemeType string; ErrorMsg error }{}
 var output bytes.Buffer
 err := tmpl.Execute(&output, data)
 if err == nil || !strings.Contains(err.Error(), "can't evaluate field Assets") {
  t.Fatalf("Erwarteter Grafana-Fehler fehlt: %v", err)
 }
}
