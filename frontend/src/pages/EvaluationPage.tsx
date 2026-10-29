import { Icon } from "../components/ui/Icons";
import { Card, Badge, PageHead } from "../components/ui/UIComponents";

export function EvaluationPage() {
  return (
    <>
      <PageHead
        eyebrow="RECORDED BASELINE"
        title="Model evaluation"
        description="Measured IndicWhisper Tamil results from an initial five-sample subset of the Tamil Kathbath validation split."
      />

      <div className="metrics-grid eval-baseline-grid">
        <Card className="metric">
          <div className="metric-icon amber">
            <Icon name="chart" />
          </div>
          <span>Word Error Rate (WER)</span>
          <strong>9.8%</strong>
          <small>Lower is better</small>
        </Card>
        <Card className="metric">
          <div className="metric-icon green">
            <Icon name="chart" />
          </div>
          <span>Character Error Rate (CER)</span>
          <strong>1.6%</strong>
          <small>Lower is better</small>
        </Card>
        <Card className="metric">
          <div className="metric-icon">
            <Icon name="audio" />
          </div>
          <span>Samples evaluated</span>
          <strong>5</strong>
          <small>Tamil validation subset</small>
        </Card>
      </div>

      <Card className="evaluation-detail-card">
        <div className="card-head">
          <div>
            <h2>Evaluation run details</h2>
            <p>Source information for the values shown above</p>
          </div>
          <Badge tone="blue">Initial baseline</Badge>
        </div>
        <div className="evaluation-detail-grid">
          <div>
            <span>Speech recognition model</span>
            <strong>IndicWhisper Tamil</strong>
          </div>
          <div>
            <span>Dataset</span>
            <strong>AI4Bharat Kathbath</strong>
          </div>
          <div>
            <span>Language</span>
            <strong>Tamil</strong>
          </div>
          <div>
            <span>Dataset split</span>
            <strong>Validation subset</strong>
          </div>
          <div>
            <span>Number of samples</span>
            <strong>5 audio samples</strong>
          </div>
          <div>
            <span>Evaluation metrics</span>
            <strong>WER and CER</strong>
          </div>
        </div>
      </Card>

      <Card className="evaluation-caveat-card">
        <div className="evaluation-caveat-icon">
          <Icon name="alert" size={20} />
        </div>
        <div>
          <h3>How to interpret these results</h3>
          <p>
            These are the recorded results from the initial five-sample
            evaluation: overall WER 9.8% and CER 1.6%. They represent only this
            small subset and must not be treated as full-dataset benchmark
            results or as a live accuracy score for each uploaded recording.
          </p>
          <p>
            WER measures word-level transcription errors. CER measures
            character-level transcription errors. More labelled Tamil samples
            should be evaluated to estimate broader performance reliably.
          </p>
        </div>
      </Card>
    </>
  );
}
