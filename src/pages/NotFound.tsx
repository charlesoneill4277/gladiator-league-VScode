import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div>
          <h1 className="text-8xl font-bold text-primary">404</h1>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Page Not Found</h2>
          <p className="text-muted-foreground">
            Sorry, the page you are looking for does not exist or has been removed.
          </p>
        </div>

        <div>
          <Button asChild variant="default" size="lg">
            <a href="/">Back to Home</a>
          </Button>
        </div>
      </div>
    </div>);

};

export default NotFound;