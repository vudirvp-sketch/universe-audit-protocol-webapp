'use client';

import * as React from 'react';
import { useAuditState } from '@/hooks/useAuditState';
import { MEDIA_TYPE_LABELS, AUTHOR_QUESTIONS, AUDIT_MODE_DESCRIPTIONS } from '@/lib/audit/protocol-data';
import { classifyAuthorProfile } from '@/lib/audit/scoring-algorithm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Sparkles, BookOpen, Film, Gamepad2, Tv, Dices } from 'lucide-react';
import type { MediaType, AuditMode, AuthorProfileAnswers } from '@/lib/audit/types';

const mediaIcons: Record<MediaType, React.ReactNode> = {
  game: <Gamepad2 className="h-4 w-4" />,
  novel: <BookOpen className="h-4 w-4" />,
  film: <Film className="h-4 w-4" />,
  anime: <Film className="h-4 w-4" />,
  series: <Tv className="h-4 w-4" />,
  ttrpg: <Dices className="h-4 w-4" />,
};

export function AuditForm() {
  const {
    inputText,
    setInputText,
    mediaType,
    setMediaType,
    auditMode,
    setAuditMode,
    authorAnswers,
    setAuthorAnswers,
    setAuthorProfile,
    setPhase,
    isLoading,
  } = useAuditState();

  const [showAuthorQuiz, setShowAuthorQuiz] = React.useState(false);
  const [authorQuizExpanded, setAuthorQuizExpanded] = React.useState(false);

  // Handle author quiz answers
  const handleAuthorAnswer = (questionId: keyof AuthorProfileAnswers, checked: boolean) => {
    const newAnswers = {
      ...authorAnswers,
      [questionId]: checked,
    } as AuthorProfileAnswers;
    
    // If all questions answered, classify profile
    if (Object.keys(newAnswers).length === 7) {
      const profile = classifyAuthorProfile(newAnswers);
      setAuthorProfile(profile);
    }
    
    setAuthorAnswers(newAnswers);
  };

  // Check if all author questions are answered
  const allAuthorQuestionsAnswered = authorAnswers && Object.keys(authorAnswers).length === 7;

  const handleStartAudit = () => {
    if (!inputText.trim()) return;
    setPhase('mode_selection');
  };

  return (
    <div className="space-y-6">
      {/* Narrative Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Narrative Input
          </CardTitle>
          <CardDescription>
            Enter your narrative concept, story outline, or world description for analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="narrative">Narrative / Concept Text</Label>
            <Textarea
              id="narrative"
              placeholder="Enter your narrative concept, story outline, or world description here...

Example: A post-apocalyptic world where memories can be extracted and traded. The protagonist, a memory dealer, discovers that their own memories have been systematically erased, leading them on a journey to recover their past while uncovering a conspiracy that threatens what remains of society..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[200px] resize-y"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {inputText.length} characters | Minimum 100 characters recommended
            </p>
          </div>

          {/* Media Type Selection */}
          <div className="space-y-2">
            <Label>Media Type</Label>
            <Select value={mediaType} onValueChange={(v) => setMediaType(v as MediaType)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select media type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(MEDIA_TYPE_LABELS) as [MediaType, string][]).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {mediaIcons[type]}
                      <span>{label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Mode</CardTitle>
          <CardDescription>
            Select the narrative structure mode that best fits your story
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={auditMode || ''}
            onValueChange={(v) => setAuditMode(v as AuditMode)}
            className="grid gap-4"
            disabled={isLoading}
          >
            {(Object.entries(AUDIT_MODE_DESCRIPTIONS) as [AuditMode, typeof AUDIT_MODE_DESCRIPTIONS.conflict][]).map(([mode, info]) => (
              <div key={mode} className="flex items-start space-x-3 rounded-md border p-4 hover:bg-accent">
                <RadioGroupItem value={mode} id={mode} className="mt-1" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={mode} className="font-medium cursor-pointer">
                      {info.name}
                    </Label>
                    <Badge variant="outline">{info.nameRu}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                  <p className="text-xs text-muted-foreground italic">
                    Detection: {info.questions}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Author Profile Quiz */}
      <Collapsible open={authorQuizExpanded} onOpenChange={setAuthorQuizExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Author Profile Quiz</CardTitle>
                  <CardDescription>
                    Optional: Answer 7 questions to determine your author profile
                  </CardDescription>
                </div>
                {authorQuizExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                These questions help determine if you&apos;re a &quot;Gardener&quot; (discovery writer) or &quot;Architect&quot; (planner), 
                which affects the types of issues the audit will prioritize.
              </p>
              
              <div className="space-y-3">
                {AUTHOR_QUESTIONS.map((q) => (
                  <div key={q.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                    <Checkbox
                      id={q.id}
                      checked={authorAnswers?.[q.id] || false}
                      onCheckedChange={(checked) => handleAuthorAnswer(q.id, checked as boolean)}
                      disabled={isLoading}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <Label htmlFor={q.id} className="text-sm cursor-pointer">
                        {q.text}
                      </Label>
                      <div className="flex items-center gap-2">
                        {q.isKeySignal && (
                          <Badge variant="secondary" className="text-xs">
                            Key Signal (×{q.weight})
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Weight: {q.weight}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {allAuthorQuestionsAnswered && (
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm font-medium">Profile determined!</p>
                  <p className="text-xs text-muted-foreground">
                    Your author profile will be calculated when the audit begins.
                  </p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Start Audit Button */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => {
            setInputText('');
            setAuditMode(null);
            setAuthorAnswers(null);
          }}
          disabled={isLoading}
        >
          Clear
        </Button>
        <Button
          onClick={handleStartAudit}
          disabled={!inputText.trim() || inputText.length < 50 || isLoading}
          className="min-w-[150px]"
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Start Audit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
