import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { APP_TITLE } from "@/const";
import { Link } from "wouter";
import { ArrowLeft, Copy, Check } from "lucide-react";

export default function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const requestResetMutation = trpc.simpleAuth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      if (data.resetToken) {
        setResetToken(data.resetToken);
        setExpiresAt(data.expiresAt);
        setError("");
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetToken(null);
    
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    requestResetMutation.mutate({ username: username.trim() });
  };

  const copyToken = () => {
    if (resetToken) {
      navigator.clipboard.writeText(resetToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Login
              </Button>
            </Link>
          </div>
          <CardTitle className="text-2xl font-bold">{APP_TITLE}</CardTitle>
          <CardDescription>
            Reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!resetToken ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={requestResetMutation.isPending}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={requestResetMutation.isPending}
              >
                {requestResetMutation.isPending ? "Generating Token..." : "Request Reset Token"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription className="space-y-3">
                  <p className="font-medium">Reset token generated successfully!</p>
                  <p className="text-sm text-muted-foreground">
                    Copy this token and use it on the password reset page. This token will expire in 1 hour.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 p-2 bg-slate-100 rounded text-xs break-all">
                      {resetToken}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyToken}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  {expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Expires at: {new Date(expiresAt).toLocaleString()}
                    </p>
                  )}
                </AlertDescription>
              </Alert>

              <Link href="/reset-password">
                <Button className="w-full">
                  Go to Reset Password Page
                </Button>
              </Link>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setResetToken(null);
                  setUsername("");
                }}
              >
                Request Another Token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
